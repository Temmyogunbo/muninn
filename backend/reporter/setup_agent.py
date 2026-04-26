"""
Retirement Specialist Agent - provides retirement planning analysis and projections.
"""

import os
import json
import logging
import random
from typing import Dict, Any
from datetime import datetime
from dataclasses import dataclass
from agents import function_tool, RunContextWrapper

from src import Database

# No tools needed - simplified agent
from agents.extensions.models.litellm_model import LitellmModel

db = Database()

logger = logging.getLogger()

@dataclass
class ProgramDataContext:
    """Context for generating a program report data from a job."""
    job_id: str

async def process_report_data_from_job(job_id: str) -> str:
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

    print(f"Program data: {program_data}")

    logger.info(f"Program data: {program_data}")

    if not program_data:
        return f"Program data generator failed: No data found for job {job_id}"

    return program_data

@function_tool
async def generate_program_data(wrapper: RunContextWrapper[ProgramDataContext]) -> str:
    """Generate the program data from a job."""
    return await generate_program_data_internal(wrapper.context.job_id)


# def create_agent(
#     program_data: Dict[str, Any], db=None
# ):
#     """Create the reporter agent with tools and context."""

#     # Get model configuration
#     model_id = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-3-7-sonnet-20250219-v1:0")
#     USE_LOCAL_DEV_MODEL = os.getenv("USE_LOCAL_DEV_MODEL", "false")
#     # Set region for LiteLLM Bedrock calls
#     bedrock_region = os.getenv("BEDROCK_REGION", "us-east-2")
#     os.environ["AWS_REGION_NAME"] = bedrock_region

#     if USE_LOCAL_DEV_MODEL == "true":
#         model = LitellmModel(model="gpt-4.1-mini")
#     else:
#         model = LitellmModel(model=f"bedrock/{model_id}")

#     # No tools needed - agent will return analysis as final output
#     tools = [invoke_job_generator]

#     # Format comprehensive context for the agent
#     task = f"""
# # Reporter Agent Context

# ## Program Outcomes
# - Program Name: {program_data.get("program_name", "")}
# - Program Type: {program_data.get("program_type", "unknown")}
# - Program Start Date: {program_data.get("program_start_date", "unknown")}
# - Program End Date: {program_data.get("program_end_date", "unknown")}
# - Program Location: {program_data.get("program_location", "unknown")}


# ## Course Details
# - Course Name: {program_data.get("course_name", "unknown")}
# - Course Description: {program_data.get("course_description", "unknown")}
# - Course Learning Outcomes: {program_data.get("course_learning_outcomes", "unknown")}
# - Course Skills: {program_data.get("course_skills", "unknown")}
# - Course Learning Objectives: {program_data.get("course_learning_objectives", "unknown")}

# ## Parent Details
# - Parent Name: {program_data.get("parent_name", "unknown")}
# - Parent Email: {program_data.get("parent_email", "unknown")}

# ## Child Details
# - Child Name: {program_data.get("child_name", "unknown")}
# - Child Age: {program_data.get("child_age", "unknown")}
# - Child Gender: {program_data.get("child_gender", "unknown")}

# ## Instructor Notes
# - Instructor Notes: {program_data.get("instructor_notes", "unknown")}

# Your task: Analyze this outcomes data and provide a comprehensive program report for the parent.
# Provide your report in clear markdown format.

# You should stick to the data provided and not make up any information.
# """

#     return model, tools, task

def create_agent(
    job_id: str
):
    """Create the reporter agent with tools and context."""

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

   # Create context for tools
    context = ProgramDataContext(job_id=job_id)
    # No tools needed - agent will return analysis as final output
    tools = [generate_program_data]

    # Format comprehensive context for the agent

    task = f"""Job {job_id} has been completed.
Generate a comprehensive program report for the parent.
Provide your report in clear markdown format.

You should stick to the data provided and not make up any information.
"""
    return model, tools, task, context
