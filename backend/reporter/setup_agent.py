"""
Retirement Specialist Agent - provides retirement planning analysis and projections.
"""

import os
import json
import logging
import random
from typing import Dict, Any
from datetime import datetime

# No tools needed - simplified agent
from agents.extensions.models.litellm_model import LitellmModel

logger = logging.getLogger()


def create_agent(
    program_data: Dict[str, Any], db=None
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

    # No tools needed - agent will return analysis as final output
    tools = []

    # Format comprehensive context for the agent
    task = f"""
# Reporter Agent Context

## Program Outcomes
- Program Name: {program_data.get("program_name", "")}
- Program Type: {program_data.get("program_type", "unknown")}
- Program Start Date: {program_data.get("program_start_date", "unknown")}
- Program End Date: {program_data.get("program_end_date", "unknown")}
- Program Location: {program_data.get("program_location", "unknown")}


## Course Details
- Course Name: {program_data.get("course_name", "unknown")}
- Course Description: {program_data.get("course_description", "unknown")}
- Course Learning Outcomes: {program_data.get("course_learning_outcomes", "unknown")}
- Course Skills: {program_data.get("course_skills", "unknown")}
- Course Learning Objectives: {program_data.get("course_learning_objectives", "unknown")}

## Parent Details
- Parent Name: {program_data.get("parent_name", "unknown")}
- Parent Email: {program_data.get("parent_email", "unknown")}

## Child Details
- Child Name: {program_data.get("child_name", "unknown")}
- Child Age: {program_data.get("child_age", "unknown")}
- Child Gender: {program_data.get("child_gender", "unknown")}

## Instructor Notes
- Instructor Notes: {program_data.get("instructor_notes", "unknown")}

Your task: Analyze this outcomes data and provide a comprehensive program report for the parent.
Provide your report in clear markdown format.

You should stick to the data provided and not make up any information.
"""

    return model, tools, task
