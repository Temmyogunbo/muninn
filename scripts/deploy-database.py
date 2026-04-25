#!/usr/bin/env python3
"""
Deploy the Muninn frontend and API infrastructure.
This script:
1. Packages the Lambda function
2. Deploys infrastructure with Terraform to get API URL
3. Builds the NextJS frontend with production API URL
4. Uploads frontend files to S3
5. Invalidates CloudFront cache

NOTE: This script uses .env.production for deployment and does NOT modify .env.local
"""

import subprocess
import sys
import os
import json
import time
from pathlib import Path

environment = sys.argv[1] if len(sys.argv) > 1 else "dev"
project_name = sys.argv[2] if len(sys.argv) > 2 else "muninn"

def run_command(cmd, cwd=None, check=True, capture_output=False, env=None):
    """Run a command and optionally capture output."""
    print(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")

    if capture_output:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, shell=isinstance(cmd, str), env=env)
        if check and result.returncode != 0:
            print(f"Error: {result.stderr}")
            sys.exit(1)
        return result.stdout.strip()
    else:
        result = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), env=env)
        if check and result.returncode != 0:
            sys.exit(1)
        return None

def setup_terraform(cwd, state_key: str | None = None):
    """
    S3 remote state. Each root module (database, agents, frontend) must have a
    unique key so their states do not overwrite each other.
    """
    if os.getenv("GITHUB_ACTIONS"):
        # In CI: pull credentials from GitHub secrets, use stricter settings
        # Get AWS account ID
        aws_account_id = run_command(
            ["aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text"],
            capture_output=True
        )

        # Get AWS region
        aws_region = os.getenv("DEFAULT_AWS_REGION", "us-east-2")
        if state_key is None:
            state_key = f"frontend/{environment}/terraform.tfstate"

        # Run terraform init (use default workspace; environment is in the key path)
        run_command([
            "terraform", "init", "-input=false", "-reconfigure",
            f"-backend-config=bucket=muninn-terraform-state-{aws_account_id}",
            f"-backend-config=key={state_key}",
            f"-backend-config=region={aws_region}",
            f"-backend-config=dynamodb_table=muninn-terraform-locks",
            f"-backend-config=encrypt=true",
        ], cwd=cwd)

def check_prerequisites():
    """Check that all required tools are installed."""
    print("🔍 Checking prerequisites...")

    # Check for required tools
    tools = {
        "docker": "Docker is required for Lambda packaging",
        "terraform": "Terraform is required for infrastructure deployment",
        "npm": "npm is required for building the frontend",
        "aws": "AWS CLI is required for S3 sync and CloudFront invalidation"
    }

    for tool, message in tools.items():
        try:
            run_command([tool, "--version"], capture_output=True)
            print(f"  ✅ {tool} is installed")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print(f"  ❌ {message}")
            sys.exit(1)

    # Check if Docker is running
    try:
        run_command(["docker", "info"], capture_output=True)
        print("  ✅ Docker is running")
    except subprocess.CalledProcessError:
        print("  ❌ Docker is not running. Please start Docker Desktop.")
        sys.exit(1)

    # Check AWS credentials
    try:
        run_command(["aws", "sts", "get-caller-identity"], capture_output=True)
        print("  ✅ AWS credentials configured")
    except subprocess.CalledProcessError:
        print("  ❌ AWS credentials not configured. Run 'aws configure'")
        sys.exit(1)



def deploy_terraform():
    """Deploy Database infrastructure with Terraform."""
    print("\n🏗️  Deploying Database infrastructure with Terraform...")

    terraform_dir = Path(__file__).parent.parent / "terraform" / "database"

    if not terraform_dir.exists():
        print(f"  ❌ Terraform directory not found: {terraform_dir}")
        sys.exit(1)

    # Setup Terraform (S3 key must match data.terraform_remote_state in main.tf)
    setup_terraform(terraform_dir, f"database/{environment}/terraform.tfstate")

    # Initialize Terraform if needed
    if not (terraform_dir / ".terraform").exists():
        print("  Initializing Terraform...")
        run_command(["terraform", "init"], cwd=terraform_dir)
        
    aws_reg = os.getenv("DEFAULT_AWS_REGION", "us-east-2")
    base_apply = [
        f"-var=aws_region={aws_reg}",
    ]
    # Plan the deployment
    print("  Planning deployment...")
    run_command(["terraform", "plan"] + base_apply, cwd=terraform_dir)

    # Apply the deployment
    print("\n  Applying deployment...")
    print("  Creating AWS resources...")
    run_command(["terraform", "apply", "-auto-approve"] + base_apply, cwd=terraform_dir)

    # Get outputs
    print("\n  Getting outputs...")
    outputs = run_command(
        ["terraform", "output", "-json"],
        cwd=terraform_dir,
        capture_output=True
    )

    return json.loads(outputs)


def main():
    """Main deployment function."""
    print("🚀 Campaign Manager - Deployment")
    print("=" * 50)

    # Check prerequisites
    check_prerequisites()
    # Frontend remote state and scripts expect this to match the chosen env (e.g. dev, test, prod)
    os.environ["TF_VAR_environment"] = environment
    if os.getenv("GITHUB_ACTIONS"):
        os.environ["TF_VAR_use_local_stack_state"] = "false"
    else:
        os.environ.setdefault("TF_VAR_use_local_stack_state", "true")



    # Deploy database
    deploy_terraform()

    print("\n" + "=" * 50)
    print("✅ Deployment complete!")

if __name__ == "__main__":
    main()