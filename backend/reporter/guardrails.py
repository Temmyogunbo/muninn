"""Input/output guardrails for the camp program reporter agent."""

from __future__ import annotations

from typing import Any

from agents import GuardrailFunctionOutput, output_guardrail

_REPORTER_CONTEXT_MARKER = "Reporter Agent Context"
_MIN_REPORT_CHARS = 180
_CLINICAL_SNIPPETS = (
    "diagnosed with",
    "diagnosis of",
    "dsm-5",
    "dsm 5",
    "clinical depression",
    "prescription medication",
    "prescription drug",
    "your child has adhd",
    "your child is autistic",
    "see a psychiatrist",
    "seek a diagnosis",
)
_BLOCKED_OUTPUT_FRAGMENTS = (
    "ignore previous instructions",
    "disregard the above",
    "system prompt",
)

@output_guardrail(name="camp_progress_report_safe")
def camp_progress_output_guardrail(_ctx, _agent, agent_output: Any) -> GuardrailFunctionOutput:
    """Ensure the camp report is substantive and avoids disallowed content for families."""
    text = agent_output if isinstance(agent_output, str) else str(agent_output or "")
    stripped = text.strip()
    if len(stripped) < _MIN_REPORT_CHARS:
        return GuardrailFunctionOutput(
            output_info={
                "reason": "report_too_short",
                "min_chars": _MIN_REPORT_CHARS,
                "length": len(stripped),
            },
            tripwire_triggered=True,
        )
    lower = stripped.lower()
    for fragment in _BLOCKED_OUTPUT_FRAGMENTS:
        if fragment in lower:
            return GuardrailFunctionOutput(
                output_info={"reason": "blocked_injection_phrase", "fragment": fragment},
                tripwire_triggered=True,
            )
    if any(s in lower for s in _CLINICAL_SNIPPETS):
        return GuardrailFunctionOutput(
            output_info={"reason": "clinical_or_diagnostic_language"},
            tripwire_triggered=True,
        )
    return GuardrailFunctionOutput(
        output_info={"length": len(stripped)},
        tripwire_triggered=False,
    )
