# Muninn database (`muninn-database`)

Python package that defines **Aurora PostgreSQL** access for Muninn: **AWS RDS Data API** (HTTP, no in-VPC connection pooler required in Lambda), **Pydantic** request/response shapes, and table-centric **query helpers** used by the **FastAPI** app in `backend/api` and by **AWS Lambdas** (for example the reporter).

---

## How it works

### Architecture

- **`DataAPIClient`** (`src/client.py`) wraps `boto3.client("rds-data")`. It reads:
  - **`AURORA_CLUSTER_ARN`**
  - **`AURORA_SECRET_ARN`**
  - **`AURORA_DATABASE`** (default `muninn`)
  - **`DEFAULT_AWS_REGION`** (default `us-east-2`)
- It runs parameterized SQL, maps the Data API record format to Python dicts, and supports `query`, `query_one`, `insert`/`update`/`delete` with typed parameter binding (including `jsonb`, `text[]`, dates, UUIDs).
- **RDS Data API** limits apply (e.g. no native array parameters for `text[]` in some cases); helpers like `_text_array_param_sql` work around this by passing JSON and expanding in SQL.

### Schema

- **`migrations/001_schema.sql`** is the source of truth for tables: `users`, `students`, `courses`, `programs`, `enrollments`, `jobs` (plus extensions, indexes, and `updated_at` triggers). Comments in the file describe columns.
- **`src/schemas.py`** — Pydantic models for create/update payloads (aligned with the migration).
- **`src/models.py`** — `Database` aggregates namespace objects (`programs`, `users`, `students`, `courses`, `enrollments`, `jobs`). Each class encapsulates table-specific SQL. Notable for reporting:
  - **`Jobs.find_by_job_id_extended`** — Joins job → enrollment → program, student, parent, course to supply the **reporter Lambda** with a single denormalized row for program/course/parent/student context.

### Public API (imports)

The package surface is exposed from `src/__init__.py`:

- **`Database`** — Main entry used across the codebase (`from src import Database`).
- **`DataAPIClient`** — Lower-level access if needed.
- **Schema types** such as `ProgramCreate`, `UserCreate`, `StudentCreate`, `CourseCreate`, `EnrollmentCreate`.

The installed distribution name is **`muninn-database`**; the import path is the **`src`** package (as declared in `pyproject.toml`).

### What this package is not

- It does **not** run the HTTP API. That lives in **`backend/api/main.py`** (FastAPI + Clerk).
- It is **not** a generic ORM; it is thin SQL + Data API mapping tailored to Muninn tables.

---

## Prerequisites

- **Python 3.12+**
- **uv** (or pip) in the `backend` workspace so `muninn-database` resolves as a workspace dependency
- For live DB/migrations: AWS credentials that can call **RDS Data API** on the target cluster, and the correct **ARNs** in the environment (often injected from **Secrets Manager** / **Terraform** in deploys)

---

## Local tooling (from `backend/database`)

```bash
cd backend
uv sync
cd database
```

| Command | Purpose |
|---------|---------|
| `uv run run_migrations.py` | Apply `migrations/001_schema.sql` statement-by-statement via the Data API. |
| `uv run seed_data.py` | Seed sample courses, users, programs, students, enrollments (see script; safe re-run for users by `clerk_user_id`). |
| `uv run reset_db.py` | Full reset path (see script; may drop and re-migrate — use only on throwaway envs). |
| `uv run main.py` | Prints a short help pointer to the commands above. |

**Requires** `AURORA_CLUSTER_ARN` and `AURORA_SECRET_ARN` in the environment (and optional `AURORA_DATABASE`).

---

## Environment variables (summary)

| Variable | Purpose |
|----------|---------|
| `AURORA_CLUSTER_ARN` | Aurora cluster ARN for `rds-data` `resourceArn` |
| `AURORA_SECRET_ARN` | Secrets Manager ARN for DB credentials |
| `AURORA_DATABASE` | Database name (default `muninn`) |
| `DEFAULT_AWS_REGION` / `AWS_REGION` | AWS region for the client |

These match what **Terraform** outputs for the database module and what Lambdas / ECS tasks receive in production.

---

## Related code

- **`backend/api/`** — HTTP layer; validates Clerk JWT, calls `Database` for CRUD and jobs.
- **`backend/reporter/`** — Report Lambda: `Database().jobs` for `find_by_job_id_extended`, `update_report`, `update_status`.
- **`terraform/database/`** — Aurora and secrets wiring.
- **`scripts/deploy_database.sh`** / **CI** — Deploy database stack before agents that depend on ARNs and secrets.
