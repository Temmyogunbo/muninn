"""
Reporter Lambda Handler — generates camp program reports via the agents SDK.
"""

import ast
import asyncio
import html
import json
import logging
import os
from typing import Any


from agents import Agent, InputGuardrailTripwireTriggered, OutputGuardrailTripwireTriggered, Runner, trace
from judge import evaluate
from guardrails import camp_progress_output_guardrail
from observability import observe
from setup_agent import setup_agent
from template import REPORTER_INSTRUCTIONS
from tools import send_program_report_email_internal
from src import Database    

db = Database()

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Judge returns score 0–100; we compare score/100 to this threshold (e.g. 0.6 => 60% required).
GUARD_AGAINST_SCORE = float(os.getenv("REPORTER_MIN_JUDGE_SCORE", "0.6"))


def process_report_data_from_job(job_id: str) -> str:
    job = db.jobs.find_by_job_id_extended(job_id=job_id)

    if not job:
        return None

    return {
               "program_name":       job.get("program_name", ""),
        "program_type":       job.get("program_type", ""),
        "program_start_date": job.get("program_start_date", ""),
        "program_end_date":   job.get("end_date", ""),
       "program_location":   job.get("program_location", ""),

        "course_name":               job.get("course_name", ""),
        "course_description":        job.get("course_description", ""),
        "course_learning_outcomes":  "\n".join(job.get("course_learning_outcomes", []) or []),
        "course_learning_objectives": "\n".join(job.get("course_learning_objectives", []) or []),
        "course_skills":             "\n".join(job.get("course_skills", []) or []),

        "parent_name":  job.get("parent_name", ""),
        "parent_email": job.get("parent_email", ""),

        "child_name":       job.get("student_name", ""),
        "child_age":        job.get("student_date_of_birth", ""),
        "child_gender":     job.get("student_gender", ""),
        "instructor_comments": job.get("instructor_notes", ""),
    }


def _markdown_to_html_email(markdown: str) -> str:
    """Wrap report markdown in a simple HTML body for email (escaped preformatted text)."""
    body = html.escape((markdown or "").strip())
    # we can use template engine
    return (
        "<!DOCTYPE html><html><body>"
        '<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:15px;line-height:1.55">'
        f"{body}</pre></body></html>"
    )


def _tool_call_name_from_raw(raw: Any) -> str | None:
    if isinstance(raw, dict):
        n = raw.get("name")
        return str(n) if n is not None else None
    n = getattr(raw, "name", None)
    return str(n) if n is not None else None


def _coerce_generate_program_data_output(output: Any) -> dict[str, Any] | None:
    """Turn the tool return value into a program-data dict, or None if it failed / unexpected."""
    if isinstance(output, dict):
        return output if ("parent_email" in output or "program_name" in output) else None
    text = (str(output) if output is not None else "").strip()
    if not text or "Program data generator failed" in text:
        return None
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    try:
        obj = ast.literal_eval(text)
        if isinstance(obj, dict):
            return obj
    except (ValueError, SyntaxError):
        pass
    return None


def _extract_program_data_from_agent_run(result) -> dict[str, Any] | None:
    """
    Read the latest generate_program_data tool result from the run transcript (no DB).

    We pair each ToolCallItem named generate_program_data with the next ToolCallOutputItem,
    which matches how the agents SDK orders items for a single-tool reporter.
    """
    from agents.items import ToolCallItem, ToolCallOutputItem

    pending_output = False
    for item in result.new_items:
        if isinstance(item, ToolCallItem):
            pending_output = _tool_call_name_from_raw(item.raw_item) == "generate_program_data"
        elif isinstance(item, ToolCallOutputItem):
            if not pending_output:
                continue
            pending_output = False
            data = _coerce_generate_program_data_output(item.output)
            if data is not None:
                return data
    return None


async def _send_parent_email_after_approval(
    job_id: str,
    report_markdown: str,
    *,
    program_data_from_tool: dict[str, Any] | None = None,
) -> None:
    """
    Send the approved report. Prefer ``program_data_from_tool`` (from generate_program_data) to
    avoid a duplicate DB read; fall back to ``process_report_data_from_job`` if missing or incomplete.
    """
    job = program_data_from_tool
    if not job or not (str(job.get("parent_email") or "").strip()):
        logger.info(
            "Email metadata: falling back to DB for job_id=%s (tool payload missing or no parent_email)",
            job_id,
        )
        job = process_report_data_from_job(job_id)
    if not job:
        logger.error("Post-approval email skipped: no job data for job_id=%s", job_id)
        return
    parent_email = (job.get("parent_email") or "").strip()
    if not parent_email:
        logger.error("Post-approval email skipped: empty parent_email for job_id=%s", job_id)
        return
    subject = "Your camp program report"
    if (job.get("program_name") or "").strip():
        subject = f"Program report: {job['program_name'].strip()}"
    html_body = _markdown_to_html_email(report_markdown)
    try:
        out = await send_program_report_email_internal(
            job_id=job_id,
            subject=subject,
            html_body=html_body,
            parent_email=parent_email,
        )
        if out.get("ok"):
            logger.info(
                "Post-approval email sent for job_id=%s to=%s",
                job_id,
                out.get("recipient"),
            )
        else:
            logger.error(
                "Post-approval email failed for job_id=%s: %s",
                job_id,
                out.get("error"),
            )
    except Exception:
        logger.exception("Post-approval email raised for job_id=%s", job_id)


async def run_reporter_agent(job_id: str) -> str:
    """
    End-to-end report pipeline for one job:

    1. **Reporter agent** — Loads program data via `generate_program_data`, then outputs the final
       markdown report. No email tool is exposed, so nothing is sent to the parent during this step.
    2. **Judge** — Scores the markdown against `REPORTER_INSTRUCTIONS` and the task (0–100 scale).
    3. **Gate** — If ``score/100 < REPORTER_MIN_JUDGE_SCORE`` (default 0.6, see env), replace the
       stored payload with a generic apology and **do not** email. If the gate passes, keep the
       markdown and **then** email via `send_program_report_email_internal`, preferring
       ``parent_email`` / ``program_name`` parsed from the `generate_program_data` tool output in
       the run transcript (no extra DB round-trip); falling back to a job row read only if needed.
    4. **Persist** — Write the final string (report or apology) to the job record.
    """
    model, tools, user_message, context = setup_agent(job_id)

    with trace("Reporter"):
        agent = Agent(
            name="Camp Program Reporter",
            instructions=REPORTER_INSTRUCTIONS,
            model=model,
            output_guardrails=[camp_progress_output_guardrail],
            tools=tools,
        )

        result = await Runner.run(agent, input=user_message, context=context, max_turns=10)

        response = result.final_output

        evaluation = await evaluate(REPORTER_INSTRUCTIONS, user_message, response, context, tools)
        score = evaluation.score / 100
        comment = evaluation.feedback
        logger.info("Judge score=%.2f feedback=%s", score, comment[:200] if comment else "")

        if score < GUARD_AGAINST_SCORE:
            logger.error(
                "Reporter score below threshold (score=%.2f required>=%.2f); not emailing parent",
                score,
                GUARD_AGAINST_SCORE,
            )
            response = "I'm sorry, I'm not able to generate a report for you. Please try again later."
        else:
            program_data_from_tool = _extract_program_data_from_agent_run(result)
            await _send_parent_email_after_approval(
                job_id, response, program_data_from_tool=program_data_from_tool
            )

    db.jobs.update_report(job_id=job_id, report_payload=response)
    return response


def lambda_handler(event, context):
    """
    Lambda handler for program report generation.
    """
    logger.info(f"Event: {event}")
    with observe():
        try:
            logger.info(f"Reporter Lambda invoked with event: {json.dumps(event)[:500]}")

            # Extract job_id from SQS message
            if 'Records' in event and len(event['Records']) > 0:
                # SQS message
                job_id = event['Records'][0]['body']
                if isinstance(job_id, str) and job_id.startswith('{'):
                    # Body might be JSON
                    try:
                        body = json.loads(job_id)
                        job_id = body.get('job_id', job_id)
                    except json.JSONDecodeError:
                        pass
            elif 'job_id' in event:
                # Direct invocation
                job_id = event['job_id']
            else:
                logger.error("No job_id found in event")
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'No job_id provided'})
                }

            logger.info(f"Reporter: Starting report generation for job {job_id}")


            result = asyncio.run(run_reporter_agent(job_id))

            db.jobs.update_status(job_id=job_id, status="completed")

            return {
                "statusCode": 200,
                "body": json.dumps(result),
            }

        except InputGuardrailTripwireTriggered as e:
            info = e.guardrail_result.output.output_info
            logger.warning("Reporter input guardrail tripwire: %s", info)
            db.jobs.update_status(job_id=job_id, status="failed", error_message=info)
            return {
                "statusCode": 422,
                "body": json.dumps(
                    {"error": "input_guardrail_blocked", "detail": info}
                ),
            }
        except OutputGuardrailTripwireTriggered as e:
            info = e.guardrail_result.output.output_info
            logger.warning("Reporter output guardrail tripwire: %s", info)

            db.jobs.update_status(job_id=job_id, status="failed", error_message=info)

            return {
                "statusCode": 422,
                "body": json.dumps(
                    {"error": "output_guardrail_blocked", "detail": info}
                ),
            }
        except Exception as e:
            logger.error("Lambda handler error: %s", e, exc_info=True)

            db.jobs.update_status(job_id=job_id, status="failed", error_message=str(e))

            return {
                "statusCode": 500,
                "body": json.dumps({"error": str(e)}),
            }

if __name__ == "__main__":
    lambda_handler({"job_id": "957fe361-3a50-4bb2-b537-b13cdfd399de", "enrollment_id": "b68b4ea2-c54d-4c37-a093-1228b31c1e85", "job_type": "generate_report",}, {"requestContext": {"functionArn": "arn:aws:lambda:us-east-2:182472159612:function:muninn-reporter"}})

    