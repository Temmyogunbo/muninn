#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TERRAFORM_DIR="$PROJECT_ROOT/terraform/agents"
DATABASE_TERRAFORM_DIR="$PROJECT_ROOT/terraform/database"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${DEFAULT_AWS_REGION:-us-east-2}

echo "🚀 Deploying to ${ENVIRONMENT}..."
echo "📂 Project root: $PROJECT_ROOT"

echo "📦 Building infrastructure and deploying Lambda functions..."
uv run $PROJECT_ROOT/scripts/deploy-agents.py $ENVIRONMENT $PROJECT_NAME

echo "🤖 Deploying agents to $ENVIRONMENT..."

cd "$TERRAFORM_DIR"

terraform init -input=false -reconfigure \
  -backend-config="bucket=muninn-terraform-state-${AWS_ACCOUNT_ID}" \
  -backend-config="key=agents/${ENVIRONMENT}/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="dynamodb_table=muninn-terraform-locks" \
  -backend-config="encrypt=true" \


terraform workspace select "$ENVIRONMENT" || terraform workspace new "$ENVIRONMENT"

# Import existing AWS resources into state if they exist but are not tracked
echo "🔁 Importing existing resources into Terraform state (if needed)..."

terraform import aws_s3_bucket.lambda_packages \
  muninn-lambda-packages-${AWS_ACCOUNT_ID} 2>/dev/null \
  && echo "  ✅ Imported S3 bucket" || echo "  ℹ️ S3 bucket already in state or doesn't exist"

terraform import aws_iam_role.lambda_role \
  muninn-reporter-lambda-role 2>/dev/null \
  && echo "  ✅ Imported IAM role" || echo "  ℹ️ IAM role already in state or doesn't exist"

terraform import aws_cloudwatch_log_group.lambda_logs \
  /aws/lambda/muninn-reporter 2>/dev/null \
  && echo "  ✅ Imported CloudWatch log group" || echo "  ℹ️ Log group already in state or doesn't exist"

# Fetch outputs from database state
echo "📡 Fetching database outputs from remote state..."
cd "$DATABASE_TERRAFORM_DIR"

terraform init -input=false -reconfigure \
  -backend-config="bucket=muninn-terraform-state-${AWS_ACCOUNT_ID}" \
  -backend-config="key=database/${ENVIRONMENT}/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="dynamodb_table=muninn-terraform-locks" \
  -backend-config="encrypt=true"

terraform workspace select "$ENVIRONMENT" || terraform workspace new "$ENVIRONMENT"

AURORA_CLUSTER_ARN=$(terraform output -raw aurora_cluster_arn 2>/dev/null)
AURORA_SECRET_ARN=$(terraform output -raw aurora_secret_arn 2>/dev/null)

if [ -z "$AURORA_CLUSTER_ARN" ] || [ -z "$AURORA_SECRET_ARN" ]; then
  echo "❌ Failed to fetch database outputs — has the database been deployed?"
  exit 1
fi


# Now apply agents with all required variables
cd "$TERRAFORM_DIR"

echo "  Applying Terraform..."

terraform apply -auto-approve \
  -var="environment=${ENVIRONMENT}" \
  -var="aws_region=${AWS_REGION}" \
  -var="aurora_cluster_arn=${AURORA_CLUSTER_ARN}" \
  -var="aurora_secret_arn=${AURORA_SECRET_ARN}" \
  -var="bedrock_model_id=${BEDROCK_MODEL_ID}" \
  -var="openai_api_key=${OPENAI_API_KEY}" \
  -var="sendgrid_api_key=${SENDGRID_API_KEY}"

echo "✅ Agents deployed!"