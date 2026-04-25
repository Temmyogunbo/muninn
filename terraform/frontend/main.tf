# Frontend & API Infrastructure

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "terraform_remote_state" "database_s3" {
  count   = var.use_local_stack_state ? 0 : 1
  backend = "s3"
  config = {
    bucket         = "muninn-terraform-state-${data.aws_caller_identity.current.account_id}"
    key            = "env:/${var.environment}/database/${var.environment}/terraform.tfstate"
    region         = var.aws_region
    dynamodb_table = "muninn-terraform-locks"
  }
}

data "terraform_remote_state" "database_local" {
  count   = var.use_local_stack_state ? 1 : 0
  backend = "local"
  config = {
    path = "${path.module}/../database/terraform.tfstate"
  }
}

data "terraform_remote_state" "agents_s3" {
  count   = var.use_local_stack_state ? 0 : 1
  backend = "s3"
  config = {
    bucket         = "muninn-terraform-state-${data.aws_caller_identity.current.account_id}"
    key            = "env:/${var.environment}/agents/${var.environment}/terraform.tfstate"
    region         = var.aws_region
    dynamodb_table = "muninn-terraform-locks"
  }
}

data "terraform_remote_state" "agents_local" {
  count   = var.use_local_stack_state ? 1 : 0
  backend = "local"
  config = {
    path = "${path.module}/../agents/terraform.tfstate"
  }
}

locals {
  database_state = var.use_local_stack_state ? data.terraform_remote_state.database_local[0] : data.terraform_remote_state.database_s3[0]
  agents_state   = var.use_local_stack_state ? data.terraform_remote_state.agents_local[0] : data.terraform_remote_state.agents_s3[0]
}

locals {
  name_prefix = "muninn-${var.environment}"  # was: "muninn" — environment now baked in here,
                                              # so every resource using name_prefix gets it for free

  common_tags = {
    Project     = "muninn"
    Part        = "frontend"
    ManagedBy   = "terraform"
    Environment = var.environment             # added
  }
}

# ========================================
# S3 Frontend Bucket
# ========================================

resource "aws_s3_bucket" "frontend" {
  # was: muninn-frontend-<account>
  # now: muninn-<env>-frontend-<account>
  bucket = "${local.name_prefix}-frontend-${data.aws_caller_identity.current.account_id}"
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "404.html"
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

# ========================================
# IAM Role & Policies for API Lambda
# ========================================

resource "aws_iam_role" "api_lambda_role" {
  name = "${local.name_prefix}-api-lambda-role"  # was: muninn-api-lambda-role
  tags = local.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.api_lambda_role.name
}

resource "aws_iam_role_policy" "api_lambda_aurora" {
  name = "${local.name_prefix}-api-lambda-aurora"  # was: muninn-api-lambda-aurora
  role = aws_iam_role.api_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds-data:ExecuteStatement",
          "rds-data:BatchExecuteStatement",
          "rds-data:BeginTransaction",
          "rds-data:CommitTransaction",
          "rds-data:RollbackTransaction"
        ]
        Resource = local.database_state.outputs.aurora_cluster_arn
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = local.database_state.outputs.aurora_secret_arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_lambda_sqs" {
  name = "${local.name_prefix}-api-lambda-sqs"  # was: muninn-api-lambda-sqs
  role = aws_iam_role.api_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = local.agents_state.outputs.sqs_queue_arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_lambda_invoke" {
  name = "${local.name_prefix}-api-lambda-invoke"  # was: muninn-api-lambda-invoke
  role = aws_iam_role.api_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = [
          # was: hardcoded "muninn-reporter"
          # now: references the environment-aware name from agents state
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:muninn-reporter-${var.environment}"
        ]
      }
    ]
  })
}

# ========================================
# API Lambda Function
# ========================================

resource "aws_lambda_function" "api" {
  filename         = "${path.module}/../../backend/api/api_lambda.zip"
  function_name    = "${local.name_prefix}-api"  # was: muninn-api
  role             = aws_iam_role.api_lambda_role.arn
  handler          = "lambda_handler.handler"
  source_code_hash = filebase64sha256("${path.module}/../../backend/api/api_lambda.zip")
  runtime          = "python3.12"
  architectures    = ["x86_64"]
  timeout          = 30
  memory_size      = 512
  tags             = local.common_tags

  environment {
    variables = {
      AURORA_CLUSTER_ARN = local.database_state.outputs.aurora_cluster_arn
      AURORA_SECRET_ARN  = local.database_state.outputs.aurora_secret_arn
      AURORA_DATABASE    = local.database_state.outputs.database_name
      DEFAULT_AWS_REGION = var.aws_region
      SQS_QUEUE_URL      = local.agents_state.outputs.sqs_queue_url
      CLERK_JWKS_URL     = var.clerk_jwks_url
      CLERK_ISSUER       = var.clerk_issuer
      ENVIRONMENT        = var.environment  # added
      CORS_ORIGINS       = "http://localhost:3000,https://${aws_cloudfront_distribution.main.domain_name}"
    }
  }

  depends_on = [
    aws_iam_role_policy.api_lambda_aurora,
    aws_iam_role_policy.api_lambda_sqs,
    aws_iam_role_policy.api_lambda_invoke,
    aws_cloudfront_distribution.main
  ]
}

# CloudWatch Log Group for API Lambda
resource "aws_cloudwatch_log_group" "api_lambda_logs" {
  name              = "/aws/lambda/${local.name_prefix}-api"  # was: not explicit — now: /aws/lambda/muninn-<env>-api
  retention_in_days = 7
  tags              = local.common_tags
}

# ========================================
# API Gateway
# ========================================

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api-gateway"  # was: muninn-api-gateway
  protocol_type = "HTTP"
  tags          = local.common_tags

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["authorization", "content-type", "x-amz-date", "x-api-key", "x-amz-security-token"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins     = ["*"]
    max_age           = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
  tags        = local.common_tags

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 100
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.api.invoke_arn
}

resource "aws_apigatewayv2_route" "api_any" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "api_options" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "OPTIONS /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ========================================
# CloudFront Distribution
# ========================================

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  tags                = local.common_tags
  comment             = "Muninn Frontend - ${var.environment}"  # was: "Program Frontend"

  origin {
    domain_name = aws_s3_bucket_website_configuration.frontend.website_endpoint
    origin_id   = "S3-${aws_s3_bucket.frontend.id}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  origin {
    domain_name = replace(aws_apigatewayv2_api.main.api_endpoint, "https://", "")
    origin_id   = "API-Gateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "API-Gateway"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Accept"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}