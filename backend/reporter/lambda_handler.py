"""
Reporter Lambda Handler — generates camp program reports via the agents SDK.
"""

import asyncio
import json
import logging

from typing import Any, Dict, Optional


from agents import Agent, InputGuardrailTripwireTriggered, OutputGuardrailTripwireTriggered, Runner, trace
from judge import evaluate
from guardrails import camp_progress_output_guardrail, reporter_input_guardrail
from observability import observe
from setup_agent import create_agent
from template import REPORTER_INSTRUCTIONS
from src import Database    

db = Database()

logger = logging.getLogger()
logger.setLevel(logging.INFO)

GUARD_AGAINST_SCORE = 0.6  # Guard against score being too low


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

async def run_reporter_agent(details: Dict[str, Any], job_id: str) -> str:
    """Run the reporter agent to generate a program report."""
    model, _tools, user_message = create_agent(details)

    with trace("Reporter"):
        agent = Agent(
            name="Camp Program Reporter",
            instructions=REPORTER_INSTRUCTIONS,
            model=model,
            input_guardrails=[reporter_input_guardrail],
            output_guardrails=[camp_progress_output_guardrail],
        )

        result = await Runner.run(agent, input=user_message, max_turns=10)

        response = result.final_output

        evaluation = await evaluate(REPORTER_INSTRUCTIONS, user_message, response)
        score = evaluation.score / 100
        comment = evaluation.feedback
        observation = f"Score: {score} - Feedback: {comment}"
        if score < GUARD_AGAINST_SCORE:
            logger.error(f"Reporter score is too low: {score}")
            response = "I'm sorry, I'm not able to generate a report for you. Please try again later."
    
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

            details = process_report_data_from_job(job_id)

            result = asyncio.run(run_reporter_agent(details, job_id))

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
    lambda_handler({"job_id": "f7c3775b-5e51-4418-8c69-6d4b8421dd21", "enrollment_id": "b68b4ea2-c54d-4c37-a093-1228b31c1e85", "job_type": "generate_report",}, {"requestContext": {"functionArn": "arn:aws:lambda:us-east-2:182472159612:function:muninn-reporter"}})

    