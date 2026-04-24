#!/usr/bin/env python3
"""
Database reset for Muninn (programs, parents, students, courses, enrollments, jobs).
Drops tables, runs migrations from migrations/001_schema.sql, and loads seed_data.py.
Aligned with src/schemas.py entity fields.
"""

import argparse
import subprocess
import sys
from pathlib import Path

from src.client import DataAPIClient


def drop_all_tables(db: DataAPIClient) -> None:
    """Drop tables in dependency order (foreign keys), then the updated_at trigger function."""
    print("🗑️  Dropping existing tables...")

    # Referenced first: enrollments → students, programs; courses → programs;
    # jobs → parents(clerk_user_id); students → parents
    tables_to_drop = [
        "enrollments",
        "courses",
        "jobs",
        "students",
        "parents",
        "programs",
    ]

    for table in tables_to_drop:
        try:
            db.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
            print(f"   ✅ Dropped {table}")
        except Exception as e:
            print(f"   ⚠️  Error dropping {table}: {e}")

    try:
        db.execute("DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE")
        print("   ✅ Dropped update_updated_at_column function")
    except Exception as e:
        print(f"   ⚠️  Error dropping function: {e}")


def _row_count(db: DataAPIClient, table: str) -> int:
    rows = db.query(f"SELECT COUNT(*) AS c FROM {table}")
    if not rows:
        return 0
    val = rows[0].get("c") if isinstance(rows[0], dict) else None
    if val is None:
        val = rows[0].get("C")
    return int(val) if val is not None else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset Muninn database (schema + seed)")
    parser.add_argument(
        "--skip-drop",
        action="store_true",
        help="Skip dropping tables (only run migrations + seed)",
    )
    parser.add_argument(
        "--skip-seed",
        action="store_true",
        help="Skip seed_data.py after migrations",
    )
    args = parser.parse_args()

    print("🚀 Muninn database reset")
    print("=" * 50)

    db = DataAPIClient()

    if not args.skip_drop:
        drop_all_tables(db)

        print("\n📝 Running migrations...")
        here = Path(__file__).resolve().parent
        result = subprocess.run(
            ["uv", "run", str(here / "run_migrations.py")],
            cwd=str(here),
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            print("❌ Migration failed!")
            print(result.stderr or result.stdout)
            sys.exit(1)
        print("✅ Migrations completed")
    else:
        print("⏭️  Skipped drop + migrations (--skip-drop)")

    if not args.skip_seed:
        print("\n🌱 Loading seed data...")
        here = Path(__file__).resolve().parent
        result = subprocess.run(
            ["uv", "run", str(here / "seed_data.py")],
            cwd=str(here),
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            print("❌ Seed data failed!")
            print(result.stderr or result.stdout)
            sys.exit(1)
        if "Seed completed successfully" in (result.stdout or ""):
            print("✅ Seed data loaded (seed_data.py)")
        else:
            print("✅ Seed script finished")
            if result.stdout:
                print(result.stdout[-2000:])
    else:
        print("⏭️  Skipped seed (--skip-seed)")

    print("\n🔍 Row counts (schema entities + jobs)")
    tables = ["programs", "parents", "students", "courses", "enrollments", "jobs"]
    for table in tables:
        try:
            n = _row_count(db, table)
            print(f"   • {table}: {n} rows")
        except Exception as e:
            print(f"   • {table}: (error) {e}")

    print("\n" + "=" * 50)
    print("✅ Database reset complete!")


if __name__ == "__main__":
    main()
