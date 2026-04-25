#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME=${2:-muninn}

echo "Building frontend..."

# Anchor everything to project root from the start
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "🚀 Deploying ${PROJECT_NAME} to ${ENVIRONMENT}..."
echo "📂 Project root: $PROJECT_ROOT"

# 1. Package Lambda
echo "📦 Packaging Lambda..."
uv run $PROJECT_ROOT/scripts/package-frontend.py $ENVIRONMENT $PROJECT_NAME

echo "Building Infrasturcture..."

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${DEFAULT_AWS_REGION:-us-east-2}

cd "$PROJECT_ROOT/terraform/frontend"

terraform init -input=false -reconfigure \
  -backend-config="bucket=muninn-terraform-state-${AWS_ACCOUNT_ID}" \
  -backend-config="key=frontend/${ENVIRONMENT}/terraform.tfstate" \
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


# 2. Deploy infrastructure and Lambda functions
echo "📦 Deploying frontend and Lambda functions..."
uv run $PROJECT_ROOT/scripts/deploy-frontend.py $ENVIRONMENT $PROJECT_NAME

# 3. Final messages
echo -e "\n✅ Deployment complete!"
echo "🌐 CloudFront URL : $(terraform -chdir=$PROJECT_ROOT/terraform/frontend output -raw cloudfront_url)"
