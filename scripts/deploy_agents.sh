#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TERRAFORM_DIR="$PROJECT_ROOT/terraform/agents"
DATABASE_TERRAFORM_DIR="$PROJECT_ROOT/terraform/database"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${DEFAULT_AWS_REGION:-us-east-2}

echo "Building agents..."

# Anchor everything to project root from the start
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "🚀 Deploying ${PROJECT_NAME} to ${ENVIRONMENT}..."
echo "📂 Project root: $PROJECT_ROOT"

# 1. Deploy infrastructure and Lambda functions
echo "📦 Building infrastructure and deploying Lambda functions..."

uv run $PROJECT_ROOT/scripts/deploy-agents.py $ENVIRONMENT $PROJECT_NAME

echo "🤖 Deploying agents to $ENVIRONMENT..."

cd "$TERRAFORM_DIR"

terraform init -input=false \
  -backend-config="bucket=muninn-terraform-state-${AWS_ACCOUNT_ID}" \
  -backend-config="key=agents/${ENVIRONMENT}/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="dynamodb_table=muninn-terraform-locks" \
  -backend-config="encrypt=true"

terraform workspace select "$ENVIRONMENT" || terraform workspace new "$ENVIRONMENT"

# Fetch outputs from database state
echo "📡 Fetching database outputs from remote state..."
cd "$DATABASE_TERRAFORM_DIR"

terraform init -input=false \
  -backend-config="bucket=muninn-terraform-state-${AWS_ACCOUNT_ID}" \
  -backend-config="key=database/${ENVIRONMENT}/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="dynamodb_table=muninn-terraform-locks" \
  -backend-config="encrypt=true"

terraform workspace select "$ENVIRONMENT" || terraform workspace new "$ENVIRONMENT"

AURORA_CLUSTER_ARN=$(terraform output -raw aurora_cluster_arn)
AURORA_SECRET_ARN=$(terraform output -raw aurora_secret_arn)

echo "  ✅ Aurora Cluster ARN: $AURORA_CLUSTER_ARN"
echo "  ✅ Aurora Secret ARN:  $AURORA_SECRET_ARN"

# Now apply agents with all required variables
cd "$TERRAFORM_DIR"

terraform apply -auto-approve \
  -var="environment=${ENVIRONMENT}" \
  -var="aws_region=${AWS_REGION}" \
  -var="aurora_cluster_arn=${AURORA_CLUSTER_ARN}" \
  -var="aurora_secret_arn=${AURORA_SECRET_ARN}" \
  -var="bedrock_model_id=${BEDROCK_MODEL_ID:-anthropic.claude-3-5-sonnet-20241022-v2:0}" \
  -var="bedrock_region=${BEDROCK_REGION:-us-east-1}" \
  -var="openai_api_key=${OPENAI_API_KEY}"

echo "✅ Agents deployed!"
