"""
Muninn API — programs, users, students, courses, enrollments (see backend/database/src/schemas.py).
Uses Database from muninn-database (src.models).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime
from typing import Any, Dict, Literal, Optional, List

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from mangum import Mangum
from pydantic import BaseModel, Field, ValidationError
import boto3
import uuid
from src import Database
from src.schemas import (
    CourseCreate,
    EnrollmentCreate,
    EnrollmentUpdate,
    UserCreate,
    ProgramCreate,
    ProgramUpdate,
    StudentCreate,
)

load_dotenv(override=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Muninn API",
    description="Camp / learning programs, users, students, courses, enrollments",
    version="2.0.0",
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid input data. Please check your request and try again."},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    user_friendly = {
        401: "Your session has expired. Please sign in again.",
        403: "You don't have permission to access this resource.",
        404: "The requested resource was not found.",
        429: "Too many requests. Please slow down and try again later.",
        500: "An internal error occurred. Please try again later.",
        503: "The service is temporarily unavailable. Please try again later.",
    }
    message = user_friendly.get(exc.status_code, exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": message})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unexpected error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Our team has been notified."},
    )


db = Database()

# SQS client for job queueing
sqs_client = boto3.client('sqs', region_name=os.getenv('DEFAULT_AWS_REGION', 'us-east-2'))
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL', '')

clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL", ""))
clerk_guard = ClerkHTTPBearer(clerk_config)

async def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
) -> str:
    return creds.decoded["sub"]



class userUpsertBody(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    email: str
    phone: str
    role: Literal["parent", "instructor", "admin"]


class userUpdate(BaseModel):
    user_name: Optional[str] = Field(None, min_length=1, max_length=255)
    user_email: Optional[str] = None
    user_phone: Optional[str] = None


class StudentCreateBody(BaseModel):
    student_name: str = Field(min_length=1, max_length=255)
    date_of_birth: date
    gender: Literal["male", "female", "other"]


class ProgramEnrollmentCreateBody(BaseModel):
    """Enroll a student in a program; program_id is taken from the URL."""

    student_id: str
    enrolled_at: date = Field(default_factory=date.today)
    status: Literal["pending", "active", "completed", "withdrawn"] = "pending"
    notes: Optional[str] = None


class userProfileResponse(BaseModel):
    user: Dict[str, Any]
    created: bool


async def require_user_row(clerk_user_id: str = Depends(get_current_user_id)) -> Dict[str, Any]:
    row = db.users.find_by_clerk_user_id(clerk_user_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user profile not found.",
        )
    return row


class ReportGenerationRequest(BaseModel):
    enrollment_ids: List[str] = Field(
        min_length=1, description="IDs of the enrollments to generate a report for"
    )
    analysis_type: str = "generate_report"

class ReportGenerationResponse(BaseModel):
    job_ids: List[str]
    message: str

# --- Routes ---


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/api/user/me", response_model=userProfileResponse)
async def get_or_create_user_profile(
    clerk_user_id: str = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    """Return user row for this Clerk user, or create one from JWT name/email."""
    existing = db.users.find_by_clerk_user_id(clerk_user_id)
    if existing:
        return userProfileResponse(user=existing, created=False)

    token = creds.decoded
    name = token.get("name") or (token.get("email") or "").split("@")[0] or "user"
    email = token.get("email") or f"{clerk_user_id}@users.placeholder.local"

    user = UserCreate(
        display_name=name,
        email=email,
        phone="+1-000-000-0000",
        role="parent",
        clerk_user_id=clerk_user_id,
    )
    db.users.create_user(user)
    created = db.users.find_by_clerk_user_id(clerk_user_id)
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create user profile")
    logger.info("Created user for clerk_user_id=%s", clerk_user_id)
    return userProfileResponse(user=created, created=True)


@app.post("/api/user/me")
async def create_user_profile(
    body: userUpsertBody,
    clerk_user_id: str = Depends(get_current_user_id),
):
    """Explicitly create user (fails if already exists)."""
    print("body", body)
    print("clerk_user_id", clerk_user_id)
    if db.users.find_by_clerk_user_id(clerk_user_id):
        raise HTTPException(status_code=409, detail="user profile already exists")
    user = UserCreate(
        display_name=body.display_name,
        email=body.email,
        phone=body.phone,
        role="parent",
        clerk_user_id=clerk_user_id,
    )
    db.users.create_user(user)
    row = db.users.find_by_clerk_user_id(clerk_user_id)
    return row


@app.put("/api/user/me")
async def update_user_profile(
    body: userUpdate,
    clerk_user_id: str = Depends(get_current_user_id),
):
    user = db.users.find_by_clerk_user_id(clerk_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user profile not found")
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not data:
        return user
    db.users.update(user["id"], data)
    return db.users.find_by_clerk_user_id(clerk_user_id)


@app.get("/api/programs")
async def list_programs(clerk_user_id: str = Depends(get_current_user_id)):
    _ = clerk_user_id
    return db.programs.find_all(limit=500, offset=0)


@app.post("/api/programs")
async def create_program(
    program: ProgramCreate,
    clerk_user_id: str = Depends(get_current_user_id),
):
    _ = clerk_user_id
    pid = db.programs.create_program(program)
    return db.programs.find_by_id(pid)


@app.get("/api/programs/{program_id}")
async def get_program(
    program_id: str,
    clerk_user_id: str = Depends(get_current_user_id),
):
    _ = clerk_user_id
    row = db.programs.find_by_id(program_id)
    if not row:
        raise HTTPException(status_code=404, detail="Program not found")
    return row


@app.put("/api/programs/{program_id}")
async def update_program(
    program_id: str,
    body: ProgramUpdate,
    clerk_user_id: str = Depends(get_current_user_id),
):
    _ = clerk_user_id
    row = db.programs.find_by_id(program_id)
    if not row:
        raise HTTPException(status_code=404, detail="Program not found")
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not data:
        return row
    data["updated_at"] = datetime.now()
    db.programs.update(program_id, data)
    updated = db.programs.find_by_id(program_id)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to load program after update")
    return updated


@app.delete("/api/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    program_id: str,
    clerk_user_id: str = Depends(get_current_user_id),
):
    _ = clerk_user_id
    row = db.programs.find_by_id(program_id)
    if not row:
        raise HTTPException(status_code=404, detail="Program not found")
    db.programs.delete(program_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/programs/{program_id}/enrollments")
async def list_program_enrollments(
    program_id: str,
    # user: Dict[str, Any] = Depends(require_user_row),
):
    """Enrollments for this program, limited to the signed-in user's students."""
    program = db.programs.find_by_id(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return db.enrollments.find_by_program_id(program_id)


@app.post("/api/programs/{program_id}/enrollments")
async def add_program_enrollment(
    program_id: str,
    body: ProgramEnrollmentCreateBody,
    # user: Dict[str, Any] = Depends(require_user_row),
):
    program = db.programs.find_by_id(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    student = db.students.find_by_id(body.student_id)
    if not student:
        raise HTTPException(status_code=403, detail="Student does not belong to this user")
    enrollment = EnrollmentCreate(
        student_id=body.student_id,
        program_id=program_id,
        enrolled_at=body.enrolled_at,
        status=body.status,
        notes=body.notes,
    )
    eid = db.enrollments.create_enrollment(enrollment)
    return db.enrollments.find_by_id(eid)


@app.put("/api/programs/{program_id}/enrollments/{enrollment_id}")
async def update_program_enrollment(
    program_id: str,
    enrollment_id: str,
    body: EnrollmentUpdate,
    user: Dict[str, Any] = Depends(require_user_row),
):
    """Update an enrollment in this program (e.g. status, dates, or notes)."""
    row = db.enrollments.find_by_id(enrollment_id)
    if not row or str(row.get("program_id")) != str(program_id):
        raise HTTPException(status_code=404, detail="Enrollment not found")
    student = db.students.find_by_id(str(row["student_id"]))
    if not student:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not data:
        return row
    data["updated_at"] = datetime.now()
    db.enrollments.update(enrollment_id, data)
    updated = db.enrollments.find_by_id(enrollment_id)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to load enrollment after update")
    return updated


@app.delete(
    "/api/programs/{program_id}/enrollments/{enrollment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_program_enrollment(
    program_id: str,
    enrollment_id: str,
    user: Dict[str, Any] = Depends(require_user_row),
):
    row = db.enrollments.find_by_id(enrollment_id)
    if not row or str(row.get("program_id")) != str(program_id):
        raise HTTPException(status_code=404, detail="Enrollment not found")
    student = db.students.find_by_id(str(row["student_id"]))
    if not student:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.enrollments.delete(enrollment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/students")
async def list_my_students(
    user: Dict[str, Any] = Depends(require_user_row),
):
    return db.students.find_all(limit=500, offset=0)


@app.post("/api/students")
async def create_student(
    body: StudentCreateBody,
    user: Dict[str, Any] = Depends(require_user_row),
):
    student = StudentCreate(
        student_name=body.student_name,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        parent_id=str(user["id"]),
    )
    sid = db.students.create_student(student)
    return db.students.find_by_id(sid)


@app.get("/api/students/{student_id}")
async def get_student(
    student_id: str,
    user: Dict[str, Any] = Depends(require_user_row),
):
    student = db.students.find_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@app.get("/api/courses")
async def list_courses(
    program_id: Optional[str] = None,
    clerk_user_id: str = Depends(get_current_user_id),
):
    _ = clerk_user_id
    if program_id:
        return db.courses.find_by_program(program_id)
    return db.courses.find_all(limit=500, offset=0)


@app.post("/api/courses")
async def create_course(
    course: CourseCreate,
    clerk_user_id: str = Depends(get_current_user_id),
):
    _ = clerk_user_id
    cid = db.courses.create_course(course)
    return db.courses.find_by_id(cid)

@app.get("/api/enrollments")
async def list_enrollments(
    _clerk: str = Depends(get_current_user_id),
    enrollment_ids: List[str] = Query(
        ...,
        alias="id",
        description="Enrollment row id(s) to return. Repeat the query param for each id.",
    ),
):
    """Return enrollment row(s) for the given id(s) (e.g. report generator by enrollment)."""
    _ = _clerk
    return db.enrollments.find_by_ids(enrollment_ids)


@app.post("/api/generate", response_model=ReportGenerationResponse)
async def trigger_report_generation(
    request: ReportGenerationRequest,
    # clerk_user_id: str = Depends(get_current_user_id),
):
    """Create one job per enrollment and queue each to SQS."""
    logger.info(f"Triggering report generation")

    try:
        job_ids: List[str] = []
        for enrollment_id in request.enrollment_ids:
            job_id = db.jobs.create_job(enrollment_id=enrollment_id, job_type="generate_report", request_payload=request.model_dump())
            job_ids.append(str(job_id))
            logger.info(f"Created job: {job_id}")

            if SQS_QUEUE_URL:
                message = {'job_id': str(job_id), 'enrollment_id': enrollment_id, 'job_type': request.analysis_type}
                sqs_client.send_message(QueueUrl=SQS_QUEUE_URL, MessageBody=json.dumps(message))
                logger.info(f"Sent analysis job to SQS: {job_id}")
            else:
                logger.warning("SQS_QUEUE_URL not configured, job created but not queued")

        if len(job_ids) == 0:
            raise HTTPException(status_code=400, detail="No enrollment IDs provided")

        return ReportGenerationResponse(
            job_ids=job_ids,
            message="Report generation started. Check job status for results.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    enrollment_id: str,
    # _clerk: str = Depends(get_current_user_id),
):
    """Get job status and results (report payload) for an enrollment-scoped job."""
    # _ = _clerk
    try:
        job = db.jobs.find_by_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if str(job.get("enrollment_id")) != str(enrollment_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        return job

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jobs")
async def list_jobs(
    # _clerk: str = Depends(get_current_user_id),
    enrollment_ids: Optional[List[str]] = Query(
        None,
        description="Filter to jobs for one or more enrollments. Repeat the query param for each id.",
    ),
    limit: int = Query(100, ge=1, le=500),
):
    """List report jobs, optionally filtered by enrollment_id(s)."""
    # _ = _clerk
    try:
        if enrollment_ids:
            jobs_list = db.jobs.find_by_enrollment_ids(enrollment_ids, limit=limit)
        else:
            jobs_list = db.jobs.find_all(limit=limit, offset=0)
        jobs_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"jobs": jobs_list}

    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

handler = Mangum(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
