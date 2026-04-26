"""Shared run context for the reporter agent and its tools."""

from dataclasses import dataclass


@dataclass
class ProgramDataContext:
    """Context for reporter agent tools (tied to a single job)."""

    job_id: str
