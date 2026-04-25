# Frontend & API Configuration

# AWS region for deployment
aws_region = "us-east-2"

# Clerk configuration for JWT validation
# Get these from your Clerk dashboard
# The JWKS URL is: https://[your-instance].clerk.accounts.dev/.well-known/jwks.json
# The issuer is: https://[your-instance].clerk.accounts.dev
clerk_jwks_url = "https://natural-stork-59.clerk.accounts.dev/.well-known/jwks.json"
clerk_issuer   = "https://natural-stork-59.clerk.accounts.dev"