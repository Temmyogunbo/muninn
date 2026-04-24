"""
Muninn database package entrypoint.

Run tooling from the `backend/database` directory, for example:
  uv run run_migrations.py
  uv run seed_data.py
  uv run reset_db.py

The HTTP API lives in `backend/api/main.py`.
"""


def main() -> None:
    print(
        "Muninn database package.\n"
        "  uv run run_migrations.py  — apply migrations/001_schema.sql\n"
        "  uv run seed_data.py       — load sample programs/users/students/…\n"
        "  uv run reset_db.py        — drop, migrate, seed\n"
        "\n"
        "API: backend/api/main.py (FastAPI + Clerk)."
    )


if __name__ == "__main__":
    main()
