from agents import Agent, Runner
from pydantic import BaseModel, Field
import os
import logging
from agents.extensions.models.litellm_model import LitellmModel

logger = logging.getLogger()


class Evaluation(BaseModel):
    feedback: str = Field(
        description="Your feedback on the end of camp report and rationale for your score"
    )
    score: float = Field(
        description="Score from 0 to 100 where 0 represents a terrible quality end of camp report and 100 represents an outstanding end of camp report"
    )


async def evaluate(original_instructions, original_task, original_output, context, tools) -> Evaluation:
    # Get model configuration
    model_id = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-3-7-sonnet-20250219-v1:0")
    # Set region for LiteLLM Bedrock calls
    bedrock_region = os.getenv("BEDROCK_REGION", "us-east-2")
    use_local_dev_model = os.getenv("USE_LOCAL_DEV_MODEL", "false")
    
    logger.info(f"DEBUG: BEDROCK_REGION from env = {bedrock_region}")
    os.environ["AWS_REGION_NAME"] = bedrock_region
    logger.info(f"DEBUG: Set AWS_REGION_NAME to {bedrock_region}")

    if use_local_dev_model == "true":
        model = LitellmModel(model="gpt-4.1-mini")
    else:
        model = LitellmModel(model=f"bedrock/{model_id}")

    instructions = """
You are an Evaluation Agent that evaluates the quality of a end of camp report from a reporter agent.
You will be provided with the instructions that were sent to the reporter agent, and its output, and you must evaluate the quality of the output.
"""

    # Create task
    task = f"""
The reporter agent was given the following instructions:

{original_instructions}

And it was assigned this task:

{original_task}

The reporter agent's output was:

{original_output}

Evaluate this output and respond with your comments and score.
"""

    try:
        logger.info("Judging end of camp report")
        agent = Agent(
            name="Judge Agent",
            instructions=instructions,
            model=model,
            output_type=Evaluation,
            tools=tools,
        )
        result = await Runner.run(agent, input=task, context=context, max_turns=5)
        return result.final_output_as(Evaluation)
    except Exception as e:
        logger.error(f"Error evaluating end of camp report: {e}")
        return Evaluation(feedback=f"Error evaluating end of camp report: {e}", score=80)
