#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME=${2:-muninn}

echo "Building agents..."

# Anchor everything to project root from the start
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "🚀 Deploying ${PROJECT_NAME} to ${ENVIRONMENT}..."
echo "📂 Project root: $PROJECT_ROOT"

# 1. Deploy infrastructure and Lambda functions
echo "📦 Building infrastructure and deploying Lambda functions..."

uv run $PROJECT_ROOT/scripts/deploy-agents.py $ENVIRONMENT $PROJECT_NAME

# 2. Final messages
echo -e "\n✅ Deployment complete!"
