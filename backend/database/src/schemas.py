"""
Pydantic schemas for data validation and LLM tool interfaces.
These models reflect database entities: Programs, Parent, Student, Enrollment,
Course, courseSkills, and Skills.
"""

from datetime import date
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProgramCreate(BaseModel):
    """Schema for a camp / learning program"""

    name: str = Field(description="Display name of the program", min_length=1, max_length=255)
    start_date: date = Field(description="Program start date")
    end_date: date = Field(description="Program end date")
    location: str = Field(description="Location of the program", min_length=1, max_length=255)
    program_type: Literal["summer_camp", "after_school_program", "online_program", "holiday_camp"] = Field(description="Type of the program")
    course_id: UUID = Field(description="ID of the course")


class ProgramUpdate(BaseModel):
    """Partial update for a program (only set fields are applied)."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location: Optional[str] = Field(None, min_length=1, max_length=255)
    program_type: Optional[Literal["summer_camp", "after_school_program", "online_program", "holiday_camp"]] = None
    course_id: Optional[UUID] = Field(None, description="Linked course for this program")


class UserCreate(BaseModel):
    """Schema for creating a user - suitable for LLM tool input"""

    display_name: str = Field(description="Name of the user")
    email: str = Field(description="Email of the user")
    phone: str = Field(description="Phone number of the user")
    role: Literal["parent", "instructor", "admin"] = Field(description="Role of the user")
    clerk_user_id: str = Field(description="Clerk user ID of the user")


class StudentCreate(BaseModel):
    """Schema for creating a student - suitable for LLM tool input"""

    student_name: str = Field(description="Name of the student")
    date_of_birth: date = Field(description="Date of birth of the student")
    gender: Literal["male", "female", "other"] = Field(description="Gender of the student")
    parent_id: str = Field(description="ID of the parent")


class CourseCreate(BaseModel):
    """Schema for a course (optionally tied to a program)"""

    title: str = Field(description="Course title", min_length=1, max_length=255)
    description: Optional[str] = Field(None, description="Course description")
    learning_outcomes: List[str] = Field(description="Learning outcomes of the course")
    learning_objectives: List[str] = Field(description="Learning objectives of the course")
    program_id: Optional[str] = Field(
        None, description="ID of the program this course belongs to, if any"
    )
    skills: List[str] = Field(description="Skills required for the course")


class EnrollmentCreate(BaseModel):
    """Schema for enrolling a student in a program"""

    student_id: UUID = Field(description="ID of the student")
    program_id: UUID = Field(description="ID of the program")
    enrolled_at: date = Field(
        default_factory=date.today, description="Date the enrollment was created"
    )
    status: Literal["pending", "active", "completed", "withdrawn"] = Field(
        default="pending", description="Enrollment status"
    )
    notes: Optional[str] = Field(None, description="Notes about the enrollment")


class EnrollmentUpdate(BaseModel):
    """Partial update for a program enrollment (only set fields are applied)."""

    enrolled_at: Optional[date] = None
    status: Optional[Literal["pending", "active", "completed", "withdrawn"]] = None
    notes: Optional[str] = None
