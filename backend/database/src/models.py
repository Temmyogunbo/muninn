"""
Database models and query builders aligned with migration schemas.
"""

from typing import Any, Dict, List, Optional

from .client import DataAPIClient
from .schemas import (
    ProgramCreate,
    UserCreate,
    StudentCreate,
    CourseCreate,
    EnrollmentCreate,
)

from datetime import datetime


class BaseModel:
    """Base class for database table operations"""

    table_name: Optional[str] = None

    def __init__(self, db: DataAPIClient):
        self.db = db
        if not self.table_name:
            raise ValueError("table_name must be defined")

    def find_by_id(self, id: Any) -> Optional[Dict]:
        """Find a record by ID"""
        sql = f"SELECT * FROM {self.table_name} WHERE id = :id::uuid"
        return self.db.query_one(sql, [{"name": "id", "value": {"stringValue": str(id)}}])

    def find_all(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Find all records with pagination"""
        sql = f"SELECT * FROM {self.table_name} LIMIT :limit OFFSET :offset"
        params = [
            {"name": "limit", "value": {"longValue": limit}},
            {"name": "offset", "value": {"longValue": offset}},
        ]
        return self.db.query(sql, params)

    def create(self, data: Dict, returning: str = "id") -> str:
        """Create a new record"""
        return self.db.insert(self.table_name, data, returning=returning)

    def update(self, id: Any, data: Dict) -> int:
        """Update a record by ID"""
        return self.db.update(self.table_name, data, "id = :id::uuid", {"id": str(id)})

    def delete(self, id: Any) -> int:
        """Delete a record by ID"""
        return self.db.delete(self.table_name, "id = :id::uuid", {"id": str(id)})


class Programs(BaseModel):
    """programs table"""

    table_name = "programs"

    def create_program(self, program: ProgramCreate) -> str:
        validated = program.model_dump()
        return self.db.insert(self.table_name, validated, returning="id")


class Users(BaseModel):
    """Users table operations"""
    table_name = 'users'
    
    def find_by_clerk_user_id(self, clerk_user_id: str) -> Optional[Dict]:
        """Find user by Clerk ID"""
        sql = f"SELECT * FROM {self.table_name} WHERE clerk_user_id = :clerk_user_id"
        params = [{'name': 'clerk_user_id', 'value': {'stringValue': clerk_user_id}}]
        return self.db.query_one(sql, params)
    
    def create_user(self, user: UserCreate) -> str:
        """Create a new user from a validated UserCreate (API passes this, not raw kwargs)."""
        data = user.model_dump()
        return self.db.insert(self.table_name, data, returning="id")

    def find_by_role(self, role: str, limit: int = 500) -> List[Dict]:
        """Users with the given role (e.g. parent for admin pickers)."""
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE role = :role
            ORDER BY display_name
            LIMIT :limit
        """
        params = [
            {"name": "role", "value": {"stringValue": role}},
            {"name": "limit", "value": {"longValue": limit}},
        ]
        return self.db.query(sql, params)


class Students(BaseModel):
    """students table"""

    table_name = "students"

    def find_by_parent(self, parent_id: str) -> List[Dict]:
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE parent_id = :parent_id::uuid
            ORDER BY student_name
        """
        params = [{"name": "parent_id", "value": {"stringValue": parent_id}}]
        return self.db.query(sql, params)

    def create_student(self, student: StudentCreate) -> str:
        validated = student.model_dump()
        return self.db.insert(self.table_name, validated, returning="id")


class Courses(BaseModel):
    """courses table"""

    table_name = "courses"

    def find_by_program(self, program_id: str) -> List[Dict]:
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE program_id = :program_id::uuid
            ORDER BY title
        """
        params = [{"name": "program_id", "value": {"stringValue": program_id}}]
        return self.db.query(sql, params)

    def create_course(self, course: CourseCreate) -> str:
        validated = course.model_dump()
        data = {k: v for k, v in validated.items() if v is not None}
        return self.db.insert(self.table_name, data, returning="id")

class Enrollments(BaseModel):
    """enrollments table"""

    table_name = "enrollments"

    def find_by_student(self, student_id: str) -> List[Dict]:
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE student_id = :student_id::uuid
            ORDER BY enrolled_at DESC
        """
        params = [{"name": "student_id", "value": {"stringValue": student_id}}]
        return self.db.query(sql, params)

    def find_by_program_id(self, program_id: str) -> List[Dict]:
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE program_id = :program_id::uuid
            ORDER BY enrolled_at DESC
        """
        params = [{"name": "program_id", "value": {"stringValue": program_id}}]
        return self.db.query(sql, params)

    def find_by_user(self, user_id: str) -> List[Dict]:
        """Enrollments for any student whose parent is this user (users.id)."""
        sql = f"""
            SELECT e.* FROM {self.table_name} e
            INNER JOIN students s ON s.id = e.student_id
            WHERE s.parent_id = :user_id::uuid
            ORDER BY e.enrolled_at DESC
        """
        params = [{"name": "user_id", "value": {"stringValue": user_id}}]
        return self.db.query(sql, params)

    def find_by_ids(self, enrollment_ids: List[str]) -> List[Dict]:
        """Rows for the given enrollment primary keys (no user filter).

             One bound parameter per id — RDS Data API does not support stringArrayValue.
        """
        if not enrollment_ids:
            return []
        n = len(enrollment_ids)
        in_clause = ", ".join(f":eid_{i}::uuid" for i in range(n))  # cast each param to uuid
        sql = f"""
            SELECT e.* FROM {self.table_name} e
            WHERE e.id IN ({in_clause})
            ORDER BY e.enrolled_at DESC
        """
        params: List[Dict] = []
        for i, eid in enumerate(enrollment_ids):
            params.append({"name": f"eid_{i}", "value": {"stringValue": str(eid)}})
        return self.db.query(sql, params)

    def find_by_program_for_parent(self, program_id: str, parent_id: str) -> List[Dict]:
        """Enrollments in this program for students belonging to the parent."""
        sql = f"""
            SELECT e.* FROM {self.table_name} e
            INNER JOIN students s ON s.id = e.student_id
            WHERE e.program_id = :program_id::uuid AND s.parent_id = :parent_id::uuid
            ORDER BY e.enrolled_at DESC
        """
        params = [
            {"name": "program_id", "value": {"stringValue": program_id}},
            {"name": "parent_id", "value": {"stringValue": parent_id}},
        ]
        return self.db.query(sql, params)

    def create_enrollment(self, enrollment: EnrollmentCreate) -> str:
        validated = enrollment.model_dump()
        return self.db.insert(self.table_name, validated, returning="id")

    def find_by_parent(self, parent_id: str) -> List[Dict]:
        """Enrollments for any student belonging to this parent."""
        sql = f"""
            SELECT e.* FROM {self.table_name} e
            INNER JOIN students s ON s.id = e.student_id
            WHERE s.parent_id = :parent_id::uuid
            ORDER BY e.enrolled_at DESC
        """
        params = [{"name": "parent_id", "value": {"stringValue": parent_id}}]
        return self.db.query(sql, params)
    


class Jobs(BaseModel):
    """Jobs table operations"""
    table_name = 'jobs'

    def create_job(self, enrollment_id: str, job_type: str,
               request_payload: Dict = None) -> str:
        """Create a new job"""
        import json
        sql = f"""
            INSERT INTO {self.table_name} 
            (enrollment_id, job_type, status, request_payload)
            VALUES 
            (:enrollment_id::uuid, :job_type, :status, :request_payload::jsonb)
        RETURNING id
        """
        params = [
            {"name": "enrollment_id", "value": {"stringValue": str(enrollment_id)}},
            {"name": "job_type",      "value": {"stringValue": job_type}},
            {"name": "status",        "value": {"stringValue": "pending"}},
            {"name": "request_payload", "value": {"stringValue": json.dumps(request_payload or {})}},
        ]
        result = self.db.query(sql, params)
        return result[0]["id"]

    def update_status(self, job_id: str, status: str, error_message: str = None) -> int:
        """Update job status"""
        data = {'status': status}
        
        if status == 'running':
            data['started_at'] = datetime.utcnow()
        elif status in ['completed', 'failed']:
            data['completed_at'] = datetime.utcnow()
        
        if error_message:
            data['error_message'] = error_message
        
        return self.db.update(self.table_name, data, "id = :id::uuid", {'id': job_id})
    
    def update_report(self, job_id: str, report_payload: Dict) -> int:
        """Update job with report payload"""
        import json
        sql = f"""
            UPDATE {self.table_name}
            SET report_payload = :report_payload::jsonb,
                updated_at = NOW()
            WHERE id = :id::uuid
        """
        params = [
            {"name": "report_payload", "value": {"stringValue": json.dumps(report_payload)}},
            {"name": "id",             "value": {"stringValue": str(job_id)}},
        ]
        return self.db.query(sql, params)

    def find_by_job_id_extended(self, job_id: str) -> Dict:
         """Find jobs for a enrollment"""
         sql = f"""
                SELECT jobs.*,
                e.id as enrollment_id,
                p.id as program_id,
                s.id as student_id,
                u.id as parent_id,
                c.id as course_id,
                p.name as program_name,
                p.program_type as program_type,
                p.start_date as program_start_date,
                p.end_date as program_end_date,
                p.location as program_location,
                c.title as course_name,
                c.description as course_description,
                c.learning_outcomes as course_learning_outcomes,
                c.learning_objectives as course_learning_objectives,
                c.skills as course_skills,
                u.display_name as parent_name,
                u.email as parent_email,
                s.student_name as student_name,
                s.date_of_birth as student_date_of_birth,
                s.gender as student_gender,
                e.notes as instructor_notes
                FROM {self.table_name}
                INNER JOIN enrollments e ON e.id = jobs.enrollment_id
                INNER JOIN programs p ON p.id = e.program_id
                INNER JOIN students s ON s.id = e.student_id
                INNER JOIN users u ON u.id = s.parent_id
                INNER JOIN courses c ON c.id = p.course_id
                WHERE jobs.id = :job_id::uuid
            """
         params = [{'name': 'job_id', 'value': {'stringValue': job_id}}]
         return self.db.query_one(sql, params)

    def find_by_enrollment_ids(self, enrollment_ids: List[str], limit: int = 100) -> List[Dict]:
        """Jobs for any of the given enrollment ids (no joins; RDS-safe IN list)."""
        if not enrollment_ids:
            return []
        n = len(enrollment_ids)
        in_clause = ", ".join(f":eid_{i}::uuid" for i in range(n)) 
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE enrollment_id IN ({in_clause})
            ORDER BY created_at DESC
            LIMIT :limit
        """
        params: List[Dict] = [{"name": "limit", "value": {"longValue": limit}}]
        for i, eid in enumerate(enrollment_ids):
            params.append({"name": f"eid_{i}", "value": {"stringValue": str(eid)}})
        return self.db.query(sql, params)


class Database:
    """Main database interface providing access to all models"""

    def __init__(
        self,
        cluster_arn: str = None,
        secret_arn: str = None,
        database: str = None,
        region: str = None,
    ):
        self.client = DataAPIClient(cluster_arn, secret_arn, database, region)

        self.programs = Programs(self.client)
        self.users = Users(self.client)
        self.students = Students(self.client)
        self.courses = Courses(self.client)
        self.enrollments = Enrollments(self.client)
        self.jobs = Jobs(self.client)

    def execute_raw(self, sql: str, parameters: List[Dict] = None) -> Dict:
        """Execute raw SQL for complex queries"""
        return self.client.execute(sql, parameters)

    def query_raw(self, sql: str, parameters: List[Dict] = None) -> List[Dict]:
        """Execute raw SELECT query"""
        return self.client.query(sql, parameters)
