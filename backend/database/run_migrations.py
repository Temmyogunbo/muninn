#!/usr/bin/env python3
"""
Migration runner: executes statements from migrations/001_schema.sql one at a time
via the RDS Data API (matches programs, users, students, courses, enrollments, jobs).
"""

import os
import boto3
from pathlib import Path
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv(override=True)

cluster_arn = os.environ.get("AURORA_CLUSTER_ARN")
secret_arn = os.environ.get("AURORA_SECRET_ARN")
database = os.environ.get("AURORA_DATABASE", "muninn")
region = os.environ.get("DEFAULT_AWS_REGION", "us-east-2")

if not cluster_arn or not secret_arn:
    raise ValueError("Missing AURORA_CLUSTER_ARN or AURORA_SECRET_ARN in environment variables")

client = boto3.client("rds-data", region_name=region)

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
SQL_FILE = MIGRATIONS_DIR / "001_schema.sql"


def _strip_line_comments(sql: str) -> str:
    """Remove full-line -- comments and trim; keeps SQL outside comments."""
    out_lines = []
    for line in sql.split("\n"):
        s = line.strip()
        if s.startswith("--"):
            continue
        if "--" in line:
            line = line[: line.index("--")].rstrip()
        out_lines.append(line)
    return "\n".join(out_lines)


def split_sql_statements(sql: str) -> list[str]:
    """
    Split SQL into executable statements. Semicolons inside $$ dollar-quoted
    blocks (e.g. PL/pgSQL functions) do not split statements.
    """
    sql = _strip_line_comments(sql)
    statements: list[str] = []
    current: list[str] = []
    i = 0
    in_dollar = False
    while i < len(sql):
        if sql[i : i + 2] == "$$":
            in_dollar = not in_dollar
            current.append("$$")
            i += 2
            continue
        if sql[i] == ";" and not in_dollar:
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            i += 1
            continue
        current.append(sql[i])
        i += 1
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


with open(SQL_FILE, encoding="utf-8") as f:
    statements = split_sql_statements(f.read())

if not statements:
    raise RuntimeError(f"No SQL statements parsed from {SQL_FILE}")

print("🚀 Running database migrations...")
print(f"    Source: {SQL_FILE}")
print("=" * 50)

success_count = 0
error_count = 0

for i, stmt in enumerate(statements, 1):
    upper = stmt.upper()
    if "CREATE TABLE" in upper:
        stmt_type = "table"
    elif "CREATE UNIQUE INDEX" in upper or "CREATE INDEX" in upper:
        stmt_type = "index"
    elif "CREATE TRIGGER" in upper:
        stmt_type = "trigger"
    elif "CREATE" in upper and "FUNCTION" in upper:
        stmt_type = "function"
    elif "CREATE EXTENSION" in upper:
        stmt_type = "extension"
    else:
        stmt_type = "statement"

    first_line = next((l for l in stmt.split("\n") if l.strip()), stmt)[:60]
    print(f"\n[{i}/{len(statements)}] Creating {stmt_type}...")
    print(f"    {first_line}...")

    try:
        client.execute_statement(
            resourceArn=cluster_arn,
            secretArn=secret_arn,
            database=database,
            sql=stmt,
        )
        print("    ✅ Success")
        success_count += 1

    except ClientError as e:
        error_msg = e.response["Error"]["Message"]
        if "already exists" in error_msg.lower():
            print("    ⚠️  Already exists (skipping)")
            success_count += 1
        else:
            print(f"    ❌ Error: {error_msg[:200]}")
            error_count += 1

print("\n" + "=" * 50)
print(f"Migration complete: {success_count} successful, {error_count} errors")

if error_count == 0:
    print("\n✅ All migrations completed successfully!")
else:
    print("\n⚠️  Some statements failed. Check errors above.")
