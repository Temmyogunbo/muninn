variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Environment name (dev, test, prod). Used to load database and agents remote state from S3 in CI and shared deploys."
  type        = string
  default     = "dev"
}

variable "use_local_stack_state" {
  description = "If true, read database and agents state from local ../database/terraform.tfstate and ../agents/terraform.tfstate. If false, read from the S3 backend (used in GitHub Actions)."
  type        = bool
  default     = false
}

# Clerk validation happens in Lambda, not at API Gateway level
variable "clerk_jwks_url" {
  description = "Clerk JWKS URL for JWT validation in Lambda"
  type        = string
}

variable "clerk_issuer" {
  description = "Clerk issuer URL (kept for Lambda environment)"
  type        = string
  default     = "" # Not actually used but kept for backwards compatibility
}


variable "project_name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "muninn"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}
