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


def _strip_header_unsafe_chars(value: str) -> str:
    """
    Remove CR/LF/NUL from strings that may become HTTP headers or auth material.
    Lambda/env secrets and DB fields sometimes include trailing newlines, which trigger:
    ValueError: Invalid header value (http.client.putheader).
    """
    if not value:
        return ""
    return value.replace("\r", "").replace("\n", "").replace("\x00", "").strip()


def _safe_subject(subject: str, max_len: int = 200) -> str:
    """Single-line subject; newlines from program names become spaces."""
    s = (subject or "").replace("\r", " ").replace("\n", " ")
    s = " ".join(s.split()).strip()
    if len(s) > max_len:
        s = s[: max_len - 3] + "..."
    return s


def _sendgrid_client() -> sendgrid.SendGridAPIClient:
    api_key = _strip_header_unsafe_chars(os.environ.get("SENDGRID_API_KEY", ""))
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY is not set")
    return sendgrid.SendGridAPIClient(api_key=api_key)


async def send_program_report_email_internal(
    *,
    job_id: str,
    subject: str,
    html_body: str,
    parent_email: str,
) -> dict[str, Any]:
    """Send an HTML email via SendGrid. parent_email must be supplied by the caller (no DB lookup)."""
    to_addr = _strip_header_unsafe_chars(parent_email or "")
    if not to_addr:
        return {"ok": False, "error": "parent_email is required and cannot be empty"}

    from_email = os.environ.get("SENDGRID_FROM_EMAIL", "temmyogunbo@gmail.com").strip()
    if not from_email:
        raise RuntimeError("SENDGRID_FROM_EMAIL is not set")

    subject_clean = _safe_subject(subject)
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
    parent_email: str,
) -> str:
    """
    Send the completed program report to the parent via email. Call once after the markdown report is ready.

    You must pass the exact parent_email value from the generate_program_data output (the parent's address on file).
    subject should be short and specific (e.g. include the program name). html_body must be full HTML, not markdown.
    """
    logger.info(f"sending email to: {parent_email}")
    job_id = wrapper.context.job_id
    result = await send_program_report_email_internal(
        job_id=job_id,
        subject=subject,
        html_body=html_body,
        parent_email=parent_email,
    )
    if result.get("ok"):
        return f"Email sent successfully to {result.get('recipient')}."
    logger.error(f"Email was not sent: {result.get('error', 'unknown error')}")
    return f"Email was not sent: {result.get('error', 'unknown error')}"
