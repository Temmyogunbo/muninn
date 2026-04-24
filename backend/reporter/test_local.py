# \!/usr/bin/env python3
"""
Test the researcher locally before deployment
"""

import asyncio

from agents import (
    Agent,
    InputGuardrailTripwireTriggered,
    OutputGuardrailTripwireTriggered,
    Runner,
    trace,
)
from dotenv import load_dotenv

from guardrails import camp_progress_output_guardrail, reporter_input_guardrail
from setup_agent import create_agent
from template import REPORTER_INSTRUCTIONS
from judge import evaluate
GUARD_AGAINST_SCORE = 0.6  # Guard against score being too low
load_dotenv(override=True)


async def test_local():
    """Test the reporter agent locally."""
    print("Testing reporter agent locally...")
    print("=" * 60)

    details = {
        "program_name": "Intro to Robotics with LEGO SPIKE",
        "program_type": "Summer Camp",
        "program_start_date": "2026-06-09",
        "program_end_date": "2026-08-14",
        "program_location": "Riverside Community Center, Portland, OR",

        "course_name": "Intro to Robotics with LEGO SPIKE",
        "course_description": "Build and program robots using sensors and motors.",
        "course_learning_outcomes": "Assemble a mobile robot chassis \n Explain how sensors drive program decisions \n",
        "course_learning_objectives": "Use loops and conditionals in block-based code \n Document one design iteration in a short lab note",
        "course_skills": "teamwork, problem-solving, basic programming",

        "parent_name": "Jordan Lee",
        "parent_email": "jordan.lee.seed@example.com",

        "child_name": "Dev Patel",
        "child_age": "10",
        "child_gender": "male",


        "instructor_notes": "Dev is a very smart child who loves to learn new things."
    }

    try:
        with trace("Reporter"):
            _model, _tools, user_message = create_agent(details)
            agent = Agent(
                name="Camp Program Reporter",
                instructions=REPORTER_INSTRUCTIONS,
                model="gpt-4.1-mini",
                input_guardrails=[reporter_input_guardrail],
                output_guardrails=[camp_progress_output_guardrail],
            )

            result = await Runner.run(agent, input=user_message)
            response = result.final_output

            evaluation = await evaluate(REPORTER_INSTRUCTIONS, user_message, response)
            score = evaluation.score / 100
            comment = evaluation.feedback
            print(f"Score: {score} - Feedback: {comment}")
        if score < GUARD_AGAINST_SCORE:
            print(f"Reporter score is too low: {score}")
            response = "I'm sorry, I'm not able to generate a report for you. Please try again later."

        print("\nRESULT:")
        print("=" * 60)
        print(response)
        print("=" * 60)
        print("\n✅ Test completed successfully!")

    except InputGuardrailTripwireTriggered as e:
        info = e.guardrail_result.output.output_info
        print(f"\n⛔ Input guardrail blocked the run: {info}")
    except OutputGuardrailTripwireTriggered as e:
        info = e.guardrail_result.output.output_info
        print(f"\n⛔ Output guardrail blocked the report: {info}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_local())
