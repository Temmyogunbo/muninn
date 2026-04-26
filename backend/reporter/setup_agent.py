"""
Retirement Specialist Agent - provides retirement planning analysis and projections.
"""

import os
import json
import logging
import random
from typing import Dict, Any
from datetime import datetime
from agents import function_tool, RunContextWrapper

from context import ProgramDataContext
from src import Database

from agents.extensions.models.litellm_model import LitellmModel

db = Database()

logger = logging.getLogger()

async def process_report_data_from_job(job_id: str) -> Dict[str, Any] | None:
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


async def generate_program_data_internal(job_id: str) -> str:
    """
    Generate the program data from a job.

    Args:
        job_id: The job ID for the program

    Returns:
        Program data
    """
    program_data = await process_report_data_from_job(job_id)

    if not program_data:
        return f"Program data generator failed: No data found for job {job_id}"

    return program_data

@function_tool
async def generate_program_data(wrapper: RunContextWrapper[ProgramDataContext]) -> str:
    """Load all program and camper fields for this job. Call this first, then write the full markdown report as your final message. Do not send email; delivery runs only after an automated quality check passes."""
    return await generate_program_data_internal(wrapper.context.job_id)



def setup_agent(
    job_id: str
):
    """Setup the reporter agent with tools and context."""

    # Get model configuration
    model_id = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-3-7-sonnet-20250219-v1:0")
    USE_LOCAL_DEV_MODEL = os.getenv("USE_LOCAL_DEV_MODEL", "false")
    # Set region for LiteLLM Bedrock calls
    bedrock_region = os.getenv("BEDROCK_REGION", "us-east-2")
    os.environ["AWS_REGION_NAME"] = bedrock_region

    if USE_LOCAL_DEV_MODEL == "true":
        model = LitellmModel(model="gpt-4.1-mini")
    else:
        model = LitellmModel(model=f"bedrock/{model_id}")

    # Create context for tools (email is sent by lambda_handler only after the judge approves the report)
    context = ProgramDataContext(job_id=job_id)
    tools = [generate_program_data]

    task = f"""Job {job_id} has been completed.

1) Call the tool generate_program_data to load the job data.
2) Write the full program report in clear markdown. Your final assistant message must be this markdown only — it will be stored and may be emailed to the parent only after an automated quality review passes. Do not attempt to send email yourself; you have no email tool.

Stick to the data provided and do not invent information.
"""
    return model, tools, task, context
