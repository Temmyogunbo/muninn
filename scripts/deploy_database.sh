#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME=${2:-muninn}

echo "Building database..."

# Anchor everything to project root from the start
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/database"

echo "🚀 Deploying ${PROJECT_NAME} to ${ENVIRONMENT}..."
echo "📂 Project root: $PROJECT_ROOT"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${DEFAULT_AWS_REGION:-us-east-2}

cd "$TERRAFORM_DIR"

terraform init -input=false \
  -backend-config="bucket=muninn-terraform-state-${AWS_ACCOUNT_ID}" \
  -backend-config="key=database/${ENVIRONMENT}/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="dynamodb_table=muninn-terraform-locks" \
  -backend-config="encrypt=true"

if ! terraform workspace list | grep -q "$ENVIRONMENT"; then
  terraform workspace new "$ENVIRONMENT"
else
  terraform workspace select "$ENVIRONMENT"
fi

if [ "$ENVIRONMENT" = "prod" ]; then
  TF_APPLY_CMD=(terraform apply -var-file=prod.tfvars -var="project_name=$PROJECT_NAME" -var="environment=$ENVIRONMENT" -auto-approve)
else
  TF_APPLY_CMD=(terraform apply -var="project_name=$PROJECT_NAME" -var="environment=$ENVIRONMENT" -auto-approve)
fi

echo "🎯 Applying Terraform..."
"${TF_APPLY_CMD[@]}"