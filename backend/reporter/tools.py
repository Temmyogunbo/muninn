"""Reporter-side tools (e.g. SendGrid email)."""

from __future__ import annotations

import logging
import os
from typing import Any

import sendgrid
from sendgrid.helpers.mail import Email, Mail, To
from agents import RunContextWrapper, function_tool

from context import ProgramDataContext

logger = logging.getLogger(__name__)


def _sendgrid_client() -> sendgrid.SendGridAPIClient:
    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY is not set")
    return sendgrid.SendGridAPIClient(api_key=api_key)


async def send_program_report_email_internal(
    *,
    job_id: str,
    subject: str,
    html_body: str,
    recipient_email: str | None = None,
) -> dict[str, Any]:
    """
    Send an HTML email via SendGrid. If recipient_email is empty, resolves parent_email from the job.
    """
    # Lazy import avoids import cycle with setup_agent.
    from setup_agent import process_report_data_from_job

    to_addr = (recipient_email or "").strip()
    if not to_addr:
        job_data = await process_report_data_from_job(job_id)
        if not job_data:
            return {"ok": False, "error": f"No job data for job_id={job_id}"}
        to_addr = (job_data.get("parent_email") or "").strip()
        if not to_addr:
            return {"ok": False, "error": "No parent_email on job and no recipient provided"}

    from_email = os.environ.get("SENDGRID_FROM_EMAIL", "temmyogunbo@gmail.com").strip()
    if not from_email:
        raise RuntimeError("SENDGRID_FROM_EMAIL is not set")

    subject_clean = (subject or "").strip()
    html_clean = (html_body or "").strip()
    if not subject_clean:
        return {"ok": False, "error": "Subject is required"}
    if not html_clean:
        return {"ok": False, "error": "HTML body is required"}

    sg = _sendgrid_client()
    from_name = os.environ.get("SENDGRID_FROM_NAME", "Temmy Ogunbo").strip()
    from_e = Email(from_email, from_name) if from_name else Email(from_email)
    message = Mail(
        from_email=from_e,
        # to_emails=To(to_addr),
        to_emails=To("temmyogunbo@gmail.com"),
        subject=subject_clean,
        html_content=html_clean,
    )
    response = sg.send(message)
    status = getattr(response, "status_code", None)
    logger.info(
        "SendGrid send job_id=%s to=%s status=%s",
        job_id,
        to_addr,
        status,
    )
    if status is not None and status >= 400:
        body = getattr(response, "body", b"") or b""
        err = body.decode(errors="replace") if isinstance(body, bytes) else str(body)
        return {"ok": False, "error": f"SendGrid error {status}: {err[:500]}"}
    return {"ok": True, "status_code": status, "recipient": to_addr}


@function_tool
async def send_program_report_email(
    wrapper: RunContextWrapper[ProgramDataContext],
    subject: str,
    html_body: str,
    recipient_email: str | None = None,
) -> str:
    """
    **Required** once per job after the markdown report is written. Sends the report to the parent via email.

    Call this after drafting the full report. Use a clear subject (include program name).
    html_body must be complete HTML (not markdown). If recipient_email is omitted, the parent's
    email from the job record is used.
    """
    job_id = wrapper.context.job_id
    result = await send_program_report_email_internal(
        job_id=job_id,
        subject=subject,
        html_body=html_body,
        recipient_email=recipient_email,
    )
    if result.get("ok"):
        return f"Email sent successfully to {result.get('recipient')}."
    return f"Email was not sent: {result.get('error', 'unknown error')}"
