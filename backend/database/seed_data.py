#!/usr/bin/env python3
"""
Seed sample Muninn data: programs, parents, students, courses, and enrollments.
Validates rows with Pydantic models from src.schemas before insert.

Users are upserted by clerk_user_id (safe to re-run). Enrollments skip if the
student–program pair already exists. Other tables may still append duplicates on
repeated runs unless the DB is cleared.
"""

from __future__ import annotations

import os
import sys
from datetime import date
from uuid import UUID

from dotenv import load_dotenv

from src.client import DataAPIClient
from src.schemas import (
    CourseCreate,
    EnrollmentCreate,
    UserCreate,
    ProgramCreate,
    StudentCreate,
)

load_dotenv(override=True)

_UUID_FK_FIELDS = frozenset({"parent_id", "program_id", "student_id"})


def _uuid_params(row: dict) -> dict:
    """Bind FK columns as uuid.UUID so the client sends :name::uuid to PostgreSQL."""
    out = dict(row)
    for key in _UUID_FK_FIELDS:
        if key in out and out[key] is not None:
            out[key] = UUID(str(out[key]))
    return out


def _insert_row(db: DataAPIClient, table: str, model) -> UUID:
    """Insert a validated Pydantic model; returns generated primary key as UUID."""
    payload = _uuid_params(model.model_dump())
    raw = db.insert(table, payload, returning="id")
    if raw is None:
        raise RuntimeError(f"Insert into {table} returned no id")
    return UUID(str(raw))


def _get_or_insert_user(db: DataAPIClient, spec: UserCreate) -> tuple[UUID, bool]:
    """
    Return user id by clerk_user_id. Inserts if missing; re-runs skip duplicate inserts
    (unique idx_users_clerk_user_id).
    """
    row = db.query_one(
        "SELECT id FROM users WHERE clerk_user_id = :cid",
        [{"name": "cid", "value": {"stringValue": spec.clerk_user_id}}],
    )
    if row:
        return UUID(str(row["id"])), True
    return _insert_row(db, "users", spec), False


def _get_or_insert_enrollment(db: DataAPIClient, spec: EnrollmentCreate) -> tuple[UUID, bool]:
    """Insert enrollment unless the student is already enrolled in that program (unique pair)."""
    data = _uuid_params(spec.model_dump(exclude_none=True))
    sid = str(data["student_id"])
    pid = str(data["program_id"])
    row = db.query_one(
        """
        SELECT id FROM enrollments
        WHERE student_id = :sid::uuid AND program_id = :pid::uuid
        """,
        [
            {"name": "sid", "value": {"stringValue": sid}},
            {"name": "pid", "value": {"stringValue": pid}},
        ],
    )
    if row:
        return UUID(str(row["id"])), True
    raw = db.insert("enrollments", data, returning="id")
    if raw is None:
        raise RuntimeError("Insert into enrollments returned no id")
    return UUID(str(raw)), False


def main() -> None:
    if not os.environ.get("AURORA_CLUSTER_ARN") or not os.environ.get("AURORA_SECRET_ARN"):
        print("❌ Missing AURORA_CLUSTER_ARN or AURORA_SECRET_ARN in environment")
        sys.exit(1)

    db = DataAPIClient()

    print("🚀 Seeding Muninn sample data")
    print("=" * 50)

    # --- Parents ---
    user_specs = [
        UserCreate(
            display_name="Jordan Lee",
            email="jordan.lee.seed@example.com",
            phone="+1-503-555-0101",
            clerk_user_id="user_seed_clerk_jordan_lee",
            role="parent",
        ),
        UserCreate(
            display_name="Samira Patel",
            email="samira.patel.seed@example.com",
            phone="+1-503-555-0102",
            clerk_user_id="user_seed_clerk_samira_patel",
            role="parent",
        ),
    ]

    user_ids: list[UUID] = []
    for spec in user_specs:
        rid, existed = _get_or_insert_user(db, spec)
        user_ids.append(rid)
        tag = "↪ user (already seeded)" if existed else "✅ user"
        print(f"  {tag}: {spec.display_name} → {rid}")

    # --- Students ---
    student_specs = [
        StudentCreate(
            student_name="Alex Lee",
            date_of_birth=date(2014, 3, 12),
            gender="male",
            parent_id=str(user_ids[0]),
        ),
        StudentCreate(
            student_name="Riley Lee",
            date_of_birth=date(2016, 11, 2),
            gender="female",
            parent_id=str(user_ids[0]),
        ),
        StudentCreate(
            student_name="Dev Patel",
            date_of_birth=date(2013, 7, 21),
            gender="male",
            parent_id=str(user_ids[1]),
        ),
    ]

    student_ids: list[UUID] = []
    for spec in student_specs:
        sid = _insert_row(db, "students", spec)
        student_ids.append(sid)
        print(f"  ✅ student: {spec.student_name} → {sid}")

    # --- Courses (TEXT[] columns: learning_outcomes, learning_objectives, skills) ---
    course_specs = [
        CourseCreate(
            title="Intro to Robotics with LEGO SPIKE",
            description="Build and program robots using sensors and motors.",
            learning_outcomes=[
                "Assemble a mobile robot chassis",
                "Explain how sensors drive program decisions",
            ],
            learning_objectives=[
                "Use loops and conditionals in block-based code",
                "Document one design iteration in a short lab note",
            ],
            skills=["teamwork", "problem-solving", "basic programming"],
        ),
        CourseCreate(
            title="Python Foundations for Young Makers",
            description="Variables, functions, and simple games in Python.",
            learning_outcomes=[
                "Write functions with parameters and return values",
                "Debug syntax and logic errors with a checklist",
            ],
            learning_objectives=[
                "Complete three small console projects",
                "Read error messages and fix common mistakes",
            ],
            skills=["Python", "logical thinking", "debugging"],
        ),
        CourseCreate(
            title="Science Fair Prep: Hypothesis to Poster",
            description="Plan an experiment and present results clearly.",
            learning_outcomes=[
                "Form a testable hypothesis",
                "Summarize results for a general audience",
            ],
            learning_objectives=[
                "Create a one-page project plan",
                "Peer-review another student's draft poster",
            ],
            skills=["communication", "scientific method", "organization"],
        ),
    ]
    course_ids: list[UUID] = []
    for spec in course_specs:
        data = _uuid_params(spec.model_dump(exclude_none=True))
        cid = db.insert("courses", data, returning="id")
        course_ids.append(UUID(str(cid)))
        print(f"  ✅ course: {spec.title} → {cid}")
    print("course_specs", course_ids)

    # --- Programs (schema: ProgramCreate + program_type in DB) ---
    program_specs = [
        ProgramCreate(
            name="Discovery Summer STEM Camp 2026",
            start_date=date(2026, 6, 9),
            end_date=date(2026, 8, 14),
            location="Riverside Community Center, Portland, OR",
            program_type="summer_camp",
            course_id=str(course_ids[0]),
        ),
        ProgramCreate(
            name="After School Robotics Lab",
            start_date=date(2026, 9, 8),
            end_date=date(2027, 5, 28),
            location="Northside Learning Hub",
            program_type="after_school_program",
            course_id=str(course_ids[1]),
        ),
        ProgramCreate(
            name="Winter Coding Holiday Camp",
            start_date=date(2026, 12, 20),
            end_date=date(2026, 12, 31),
            location="Online",
            program_type="holiday_camp",
            course_id=str(course_ids[2]),
        ),
    ]

    program_ids: list[UUID] = []
    for spec in program_specs:
        pid = _insert_row(db, "programs", spec)
        program_ids.append(pid)
        print(f"  ✅ program: {spec.name} → {pid}")

    # --- Enrollments ---
    enrollment_specs = [
        EnrollmentCreate(
            student_id=str(student_ids[0]),
            program_id=str(program_ids[0]),
            enrolled_at=date(2026, 5, 1),
            status="active",
            notes=(
                "Performance: Strong grasp of build-and-test cycles; lab summaries are complete and on time. "
                "Behavior: Respectful, follows safety rules, asks clarifying questions when stuck. "
                "Participation: Regularly contributes in group discussion and volunteers to demo work during the program."
            ),
        ),
        EnrollmentCreate(
            student_id=str(student_ids[1]),
            program_id=str(program_ids[0]),
            enrolled_at=date(2026, 5, 1),
            status="pending",
            notes=(
                "Performance: Placement intake suggests age-appropriate readiness; prior teacher notes indicate steady progress in hands-on tasks. "
                "Behavior: Generally cooperative; may need prompts to stay on task in noisy labs. "
                "Participation: Tends to join activities after observing; staff will encourage paired roles once the program begins."
            ),
        ),
        EnrollmentCreate(
            student_id=str(student_ids[2]),
            program_id=str(program_ids[2]),
            enrolled_at=date(2026, 11, 15),
            status="active",
            notes=(
                "Performance: Completes coding exercises with few revisions; debugging checklist is used consistently. "
                "Behavior: Calm under time pressure; collaborates well and accepts peer feedback. "
                "Participation: Active in breakout rooms, shares screen when troubleshooting, and helps classmates during open lab blocks."
            ),
        ),
    ]

    for spec in enrollment_specs:
        eid, existed = _get_or_insert_enrollment(db, spec)
        sid_short = str(spec.student_id).replace("-", "")[:8]
        pid_short = str(spec.program_id).replace("-", "")[:8]
        tag = "↪ enrollment (already seeded)" if existed else "✅ enrollment"
        print(f"  {tag}: student …{sid_short} → program …{pid_short} ({eid})")

    # --- Verify counts ---
    print("\n" + "=" * 50)
    print("🔍 Row counts")
    for table in ("programs", "users", "students", "courses", "enrollments"):
        rows = db.query(f"SELECT COUNT(*) AS c FROM {table}")
        n = rows[0]["c"] if rows else 0
        print(f"  {table}: {n}")

    print("\n✅ Seed completed successfully.")


if __name__ == "__main__":
    main()
