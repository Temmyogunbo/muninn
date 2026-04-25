#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME=${2:-muninn}

# Anchor everything to project root from the start
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "🚀 Deploying ${PROJECT_NAME} to ${ENVIRONMENT}..."
echo "📂 Project root: $PROJECT_ROOT"

# 1. Deploy infrastructure and Lambda functions
echo "📦 Building infrastructure and deploying Lambda functions..."
# uv and deploy.py live under scripts/ (see scripts/pyproject.toml); CWD must be repo root for paths below
( cd "$PROJECT_ROOT/scripts" && uv run deploy.py $ENVIRONMENT $PROJECT_NAME )

# 2. Final messages
echo -e "\n✅ Deployment complete!"
echo "🌐 CloudFront URL : $(terraform -chdir=$PROJECT_ROOT/terraform/frontend output -raw cloudfront_url)"
