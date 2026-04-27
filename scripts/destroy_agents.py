#!/usr/bin/env python3
"""
Destroy the Muninn Agents infrastructure.
This script:
1. Destroys infrastructure with Terraform
"""

import subprocess
import sys
from pathlib import Path


def run_command(cmd, cwd=None, check=True, capture_output=False):
    """Run a command and optionally capture output."""
    print(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")

    if capture_output:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, shell=isinstance(cmd, str))
        if check and result.returncode != 0:
            print(f"Error: {result.stderr}")
            return None
        return result.stdout.strip()
    else:
        result = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str))
        if check and result.returncode != 0:
            return False
        return True


def confirm_destruction():
    """Ask for confirmation before destroying resources."""
    print("⚠️  WARNING: This will destroy all infrastructure!")
    print("This includes:")
    print("  - Lambda function")
    print("  - IAM roles and policies")
    print("  - CloudWatch log group")
    print("")

    response = input("Are you sure you want to continue? Type 'yes' to confirm: ")
    return response.lower() == 'yes'

def destroy_agents_terraform():
    """Destroy Agents Infrastructure with Terraform."""
    print("\n🏗️  Destroying Agents Infrastructure with Terraform...")

    terraform_dir = Path(__file__).parent.parent / "terraform" / "agents"

    if not terraform_dir.exists():
        print(f"  ❌ Agents Terraform directory not found: {terraform_dir}")
        return False

    # Check if Terraform is initialized
    if not (terraform_dir / ".terraform").exists():
        print("  ⚠️  Agents Terraform not initialized, nothing to destroy")
        return True

    # Destroy the infrastructure
    print("  Running Agents Terraform destroy...")
    print("  Type 'yes' when prompted to confirm destruction.")
    

    success = run_command(["terraform", "destroy", "-var-file=prod.tfvars", "-var=project_name=$PROJECT_NAME", "-var=environment=$ENVIRONMENT", "-auto-approve"], cwd=terraform_dir)

    if success:
        print("  ✅ Agents Infrastructure destroyed successfully")
    else:
        print("  ❌ Failed to destroy Agents Infrastructure")
        print("  You may need to manually clean up resources in AWS Console")

    return success

def main():
    """Main Agents destruction function."""
    print("💥 Muninn Agents Infrastructure Destruction")
    print("=" * 60)
    
    # Confirm destruction
    if not confirm_destruction():
        print("\n❌ Destruction cancelled")
        sys.exit(0)

    # Destroy Terraform infrastructure
    destroy_agents_terraform()

    print("\n" + "=" * 60)
    print("✅ Destruction complete!")
    print("\nTo redeploy, run:")
    print("  uv run scripts/deploy_agents.sh")


if __name__ == "__main__":
    main()