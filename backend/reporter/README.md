# Reporter (camp program report Lambda)

This folder is the **reporter** service: an AWS Lambda that generates **personalized end-of-camp program reports** for parents. It uses the OpenAI **Agents** SDK, **Amazon Bedrock** (or a local dev model via LiteLLM), **SendGrid** for email, and the **`muninn-database`** package for job and enrollment data.

---

## How it works

1. **Trigger** — The function is invoked with a `job_id` (direct JSON payload) or from **SQS** (body is a raw `job_id` string, or JSON containing `job_id`). See [Lambda event shape](#lambda-event-shape).

2. **Reporter agent** — `setup_agent` configures a model and a single tool, `generate_program_data`, which loads program, course, parent, and student fields from the database for that job. The model writes a **markdown** report per `REPORTER_INSTRUCTIONS` in `template.py`. The running agent is **not** given an email tool; delivery is separate.

3. **Output guardrail** — `guardrails.camp_progress_output_guardrail` rejects unsafe or trivial outputs (length, disallowed phrases) before the run completes.

4. **Judge** — `judge.evaluate` uses a small evaluation agent to score the markdown (0–100) against the same instructions and task.

5. **Gate** — If `score / 100` is **below** `REPORTER_MIN_JUDGE_SCORE` (default `0.6`), the stored payload is replaced with a short apology and **no email** is sent. If the score passes, the markdown is kept.

6. **Email (post-approval only)** — On pass, `send_program_report_email_internal` in `tools.py` sends HTML email (markdown wrapped as HTML). Recipients and subject prefer metadata parsed from the **`generate_program_data` tool output** in the run transcript, with a fallback DB read for the same job if needed.

7. **Persist** — `Database.jobs.update_report` saves the final text. The handler sets job status to `completed` on success, or `failed` on guardrail trips or other errors.

**Important:** The LLM never sends email by itself. Sending runs only after the judge approves the report.

---

## Project layout

| File | Role |
|------|------|
| `lambda_handler.py` | Entry point (`lambda_handler`), orchestration, post-judge email, DB updates |
| `setup_agent.py` | Model (Bedrock vs local OpenAI), `generate_program_data` tool, `ProgramDataContext` |
| `template.py` | `REPORTER_INSTRUCTIONS` and report style guidance |
| `tools.py` | SendGrid helper (`send_program_report_email_internal`); optional `send_program_report_email` tool is not wired to the production reporter agent |
| `judge.py` | Quality scoring agent |
| `guardrails.py` | Output safety checks for camp reports |
| `context.py` | `ProgramDataContext` (carries `job_id`) |
| `observability.py` | Tracing / observability hooks used by the handler |
| `package_docker.py` | Builds `reporter_lambda.zip` in this directory (Docker, Linux/amd64) |
| `test_local.py` | Optional local experiment script; may not match the current `setup_agent` API — prefer invoking `lambda_handler` for an integration-style test |

---

## Prerequisites

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** — the reporter depends on the workspace package **`muninn-database`** (see `pyproject.toml`).
- **AWS credentials** — for Bedrock in production-style runs, and for whatever the database client requires (Aurora, secrets, etc.).
- **Docker** — required only to run `package_docker.py` (Lambda-compatible binary layout).

---

## Install and run locally

From the **monorepo `backend` directory** (so the workspace resolves `muninn-database`):

```bash
cd backend
uv sync
```

### Run the Lambda entrypoint

From `backend/reporter`, set environment variables (see [Environment variables](#environment-variables)) and run:

```bash
cd backend/reporter
uv run python lambda_handler.py
```

The `if __name__ == "__main__"` block in `lambda_handler.py` calls `lambda_handler` with a **sample** `job_id` — replace it with a real `job_id` from your database before testing.

### Model selection

- **Local dev (OpenAI via LiteLLM):**

  ```bash
  export USE_LOCAL_DEV_MODEL=true
  # Required for many LiteLLM/OpenAI call paths, e.g.:
  export OPENAI_API_KEY=...
  ```

- **Bedrock (typical in AWS):**

  ```bash
  export USE_LOCAL_DEV_MODEL=false
  export BEDROCK_REGION=us-east-2
  export BEDROCK_MODEL_ID=us.anthropic.claude-3-7-sonnet-20250219-v1:0
  ```

### Email

To actually send after a successful judge, set `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, and optionally `SENDGRID_FROM_NAME`. Without a valid SendGrid configuration, the flow may log errors on the send step even if the report is written.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `USE_LOCAL_DEV_MODEL` | If `true`, uses `gpt-4.1-mini` via LiteLLM; otherwise `bedrock/{BEDROCK_MODEL_ID}` |
| `BEDROCK_MODEL_ID` | Bedrock model id (when not using local dev model) |
| `BEDROCK_REGION` | Sets Bedrock / `AWS_REGION_NAME` for LiteLLM |
| `REPORTER_MIN_JUDGE_SCORE` | Minimum judge score on a 0–1 scale (default `0.6`; judge returns 0–100, then /100) |
| `SENDGRID_API_KEY` | SendGrid API key (needed to email after approval) |
| `SENDGRID_FROM_EMAIL` | Verified sender address |
| `SENDGRID_FROM_NAME` | Optional display name |

Database connectivity and other secrets are defined by **`muninn-database`** and your deployment; configure them the same way as for other backend Lambdas.

---

## Lambda event shape

- **Direct invoke:** JSON object with `job_id` (UUID string).
- **SQS:** `Records[0].body` may be the raw `job_id` string, or JSON with a `job_id` field.

---

## Packaging and deployment

The deployed function is named **`muninn-reporter-${environment}`** (see `terraform/agents`).

### Build the zip (Docker)

```bash
cd backend/reporter
uv run package_docker.py
```

Produces **`reporter_lambda.zip`** in this directory. Optional: `uv run package_docker.py --deploy` updates function code in AWS (expects an existing `muninn-reporter` function and configured credentials).

### Monorepo deploy (Terraform)

From the repo, agents are typically deployed via `scripts/deploy_agents.sh` (used by CI). You can also package from `backend` with `uv run deploy_all_lambdas.py --package` when you need a fresh `reporter_lambda.zip` before apply.

`terraform` reads the zip from `backend/reporter/reporter_lambda.zip` and uploads it to the Lambda S3 source as defined in `terraform/agents/main.tf`.

---

## CI

Pushes to `main` (or manual workflow dispatch) run the **Deploy Muninn** GitHub Action (`.github/workflows/deploy.yml`), which includes an **Deploy Agents** job that runs `scripts/deploy_agents.sh` with AWS credentials and required secrets (including model and SendGrid-related values where used).

---

## Operational notes

- **Tracing** — The reporter run is wrapped with the Agents SDK `trace("Reporter")` and `observability.observe()` in the handler.
- **Guardrail and handler errors** — `InputGuardrailTripwireTriggered` and `OutputGuardrailTripwireTriggered` (and unhandled errors) set the job to `failed` and return 422/500-style responses from the handler.
- **Logs** — On AWS, use CloudWatch for `/aws/lambda/muninn-reporter-${environment}` (exact name per your Terraform/imports).

---

## Related code

- `backend/database/` — **`muninn-database`** (`from src import Database` in the reporter)
- `terraform/agents/` — Lambda, SQS event source, IAM, and S3 package wiring for the reporter
- `backend/deploy_all_lambdas.py` — Helper to build `reporter_lambda.zip`
- `scripts/deploy_agents.sh` / `scripts/deploy-agents.py` — End-to-end agents packaging and Terraform apply in deployment pipelines
