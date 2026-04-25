#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME=${2:-muninn}

echo "Building database..."

# Anchor everything to project root from the start
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "🚀 Deploying ${PROJECT_NAME} to ${ENVIRONMENT}..."
echo "📂 Project root: $PROJECT_ROOT"

# 1. Deploy infrastructure and Lambda functions
echo "📦 Building infrastructure and deploying Lambda functions..."
uv run $PROJECT_ROOT/scripts/deploy-database.py $ENVIRONMENT $PROJECT_NAME

echo "Capturing database outputs..."
AURORA_CLUSTER_ARN=$(terraform output -raw aurora_cluster_arn)
AURORA_SECRET_ARN=$(terraform output -raw aurora_secret_arn)

# Write to GitHub Actions job output
echo "aurora_cluster_arn=${AURORA_CLUSTER_ARN}" >> $GITHUB_OUTPUT
echo "aurora_secret_arn=${AURORA_SECRET_ARN}" >> $GITHUB_OUTPUT

# 2. Final messages
echo -e "\n✅ Deployment complete!"
