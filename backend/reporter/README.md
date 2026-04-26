# Reporter (camp program report Lambda)

AWS Lambda service that generates **personalized end-of-camp reports** for parents using the OpenAI **Agents** SDK, optional **Amazon Bedrock** (via LiteLLM), and **SendGrid** for email. It reads job/enrollment data through the **`muninn-database`** package and writes the final report back to the job record.

---

## How it works

1. **Trigger** — The function is invoked with a `job_id` (direct JSON payload or an SQS record whose body is `job_id` or JSON containing `job_id`).

2. **Reporter agent** — An LLM agent runs with one tool, `generate_program_data`, which loads program, course, parent, and student fields from the database for that job. The model then produces a **markdown** report following `template.py` (`REPORTER_INSTRUCTIONS`).

3. **Output guardrail** — `guardrails.py` blocks unsafe or trivial outputs (length, disallowed phrases) before the run completes.

4. **Judge** — A separate scoring agent (`judge.py`) rates the markdown report (0–100) against the same instructions and task.

5. **Gate** — If the normalized score is **below** `REPORTER_MIN_JUDGE_SCORE` (default `0.6`), the stored payload is replaced with a generic apology and **no email** is sent. If the score passes, the markdown is kept.

6. **Email (post-approval only)** — On success, `lambda_handler` calls `send_program_report_email_internal` in `tools.py`. It prefers `parent_email` / `program_name` parsed from the **`generate_program_data` tool output** in the run transcript to avoid an extra DB read; if that is missing, it falls back to loading the job row again.

7. **Persist** — `Database.jobs.update_report` saves the final text (report or apology). The handler also updates job status on success or failure paths.

The LLM **does not** have an email tool: sending only happens **after** the judge approves the report.

---

## Project layout

| File | Role |
|------|------|
| `lambda_handler.py` | Entry point, orchestration, email after judge, DB updates |
| `setup_agent.py` | Model selection (Bedrock vs local OpenAI), `generate_program_data` tool, run context |
| `template.py` | `REPORTER_INSTRUCTIONS` and examples |
| `tools.py` | SendGrid send helper + optional `send_program_report_email` tool (not given to the reporter agent) |
| `judge.py` | Quality scoring agent |
| `guardrails.py` | Output safety checks |
| `context.py` | `ProgramDataContext` (`job_id`) |
| `observability.py` | Tracing/observability hooks |
| `package_docker.py` | Builds `reporter_lambda.zip` for deployment |

---

## Prerequisites

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** (recommended) — the reporter is a member of the `backend` workspace and depends on **`muninn-database`** (`workspace = true` in `pyproject.toml`).
- **AWS credentials** — for Bedrock (production-style runs) and for the database client if it uses AWS APIs.
- **Docker** — only required to run `package_docker.py` (Linux/amd64-compatible zip).

---

## Install and run locally

From the **monorepo `backend` directory** (so the workspace resolves `muninn-database`):

```bash
cd backend
uv sync
```

From **`backend/reporter`**, run the handler module with a real `job_id` and environment variables set (see below). Example:

```bash
cd backend/reporter
uv run python lambda_handler.py
```

The `if __name__ == "__main__"` block at the bottom of `lambda_handler.py` invokes `lambda_handler` with a sample event — **replace the `job_id`** with one that exists in your database before relying on it.

Ensure the **database** and **LLM** env vars are available (e.g. `.env` loaded by your shell or IDE). For a quick OpenAI-based run without Bedrock:

```bash
export USE_LOCAL_DEV_MODEL=true
# plus OPENAI_API_KEY as required by LiteLLM / your provider
```

For **Bedrock** (typical in AWS):

```bash
export USE_LOCAL_DEV_MODEL=false
export BEDROCK_REGION=us-east-2
export BEDROCK_MODEL_ID=us.anthropic.claude-3-7-sonnet-20250219-v1:0
```

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `USE_LOCAL_DEV_MODEL` | If `true`, uses `gpt-4.1-mini` via LiteLLM; otherwise `bedrock/{BEDROCK_MODEL_ID}` |
| `BEDROCK_MODEL_ID` | Bedrock model id (when not using local dev model) |
| `BEDROCK_REGION` | Region for Bedrock / `AWS_REGION_NAME` for LiteLLM |
| `REPORTER_MIN_JUDGE_SCORE` | Minimum judge score **0–1** (default `0.6`; judge outputs 0–100, then divided by 100) |
| `SENDGRID_API_KEY` | SendGrid API key (required to send email after approval) |
| `SENDGRID_FROM_EMAIL` | Verified sender address |
| `SENDGRID_FROM_NAME` | Optional display name |

Database-related variables are defined by **`muninn-database`** / your deployment (e.g. Aurora, secrets). Configure them the same way you do for other backend Lambdas.

---

## Lambda event shape

- **Direct invoke:** JSON object with `job_id` (UUID string).
- **SQS:** `Records[0].body` may be the raw `job_id` string or JSON with a `job_id` field.

---

## Packaging for AWS

Requires Docker:

```bash
cd backend/reporter
uv run package_docker.py
```

Produces **`reporter_lambda.zip`** in this directory. Terraform (or your deploy pipeline) should upload it and wire the function handler (typically `lambda_handler.lambda_handler`). See `package_docker.py` for copied modules and dependency install details.

From the repo, **`backend/deploy_all_lambdas.py`** can drive packaging and Terraform apply (see that script’s `--help`).

---

## Operational notes

- **Tracing:** Runs are wrapped with the Agents SDK `trace` and `observability.observe()` where configured.
- **Failures:** Guardrail trips and uncaught exceptions mark the job failed and return appropriate HTTP-style status codes from the handler.
- **Email failures** after a passing score are logged; the approved markdown may still be persisted — check CloudWatch logs and SendGrid configuration.

---

## Related code

- **`backend/database/`** — `muninn-database` (`src` package) used as `from src import Database`.
- **`terraform/agents/`** — Infrastructure for the reporter Lambda and related resources.
