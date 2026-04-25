#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME=${2:-muninn}

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/database"

echo "🚀 Deploying ${PROJECT_NAME} to ${ENVIRONMENT}..."
echo "📂 Project root: $PROJECT_ROOT"

echo "📦 Building infrastructure and deploying Lambda functions..."
uv run $PROJECT_ROOT/scripts/deploy-database.py $ENVIRONMENT $PROJECT_NAME

echo "Capturing database outputs..."

# Must run terraform output FROM the terraform/database directory
cd "$TERRAFORM_DIR"

AURORA_CLUSTER_ARN=$(terraform output -raw aurora_cluster_arn 2>/dev/null)
AURORA_SECRET_ARN=$(terraform output -raw aurora_secret_arn 2>/dev/null)

# Validate outputs before writing to GITHUB_OUTPUT
if [ -z "$AURORA_CLUSTER_ARN" ]; then
  echo "❌ Failed to capture aurora_cluster_arn from terraform output"
  exit 1
fi

if [ -z "$AURORA_SECRET_ARN" ]; then
  echo "❌ Failed to capture aurora_secret_arn from terraform output"
  exit 1
fi

echo "  ✅ Aurora Cluster ARN: $AURORA_CLUSTER_ARN"
echo "  ✅ Aurora Secret ARN:  $AURORA_SECRET_ARN"

# Write to GitHub Actions job output
echo "aurora_cluster_arn=${AURORA_CLUSTER_ARN}" >> $GITHUB_OUTPUT
echo "aurora_secret_arn=${AURORA_SECRET_ARN}" >> $GITHUB_OUTPUT

echo -e "\n✅ Deployment complete!"