terraform {
  required_version = ">= 1.5"
  
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

# ========================================
# SQS Queue for Async Job Processing
# ========================================

resource "aws_sqs_queue" "analysis_jobs" {
  name                       = "muninn-analysis-jobs-${var.environment}"  # was: muninn-analysis-jobs
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 10
  visibility_timeout_seconds = 910

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.analysis_jobs_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Project     = "muninn"
    Part        = "agents"
    Environment = var.environment
  }
}

resource "aws_sqs_queue" "analysis_jobs_dlq" {
  name = "muninn-analysis-jobs-dlq-${var.environment}"  # was: muninn-analysis-jobs-dlq

  tags = {
    Project     = "muninn"
    Part        = "agents"
    Environment = var.environment
  }
}

# ========================================
# S3 Bucket for Lambda deployment
# ========================================

resource "aws_s3_bucket" "lambda_packages" {
  bucket = "muninn-lambda-packages-${var.environment}-${data.aws_caller_identity.current.account_id}"  # added environment

  tags = {
    Project     = "muninn"
    Part        = "agents"
    Environment = var.environment
  }
}

resource "aws_s3_object" "lambda_packages" {
  for_each = toset(["reporter"])

  bucket = aws_s3_bucket.lambda_packages.id
  key    = "${each.key}/${each.key}_lambda.zip"
  source = "${path.module}/../../backend/${each.key}/${each.key}_lambda.zip"
  etag   = fileexists("${path.module}/../../backend/${each.key}/${each.key}_lambda.zip") ? filemd5("${path.module}/../../backend/${each.key}/${each.key}_lambda.zip") : null

  tags = {
    Project     = "muninn"
    Part        = "agents"
    Agent       = each.key
    Environment = var.environment
  }
}

# ========================================
# Lambda Function for Reporter
# ========================================

resource "aws_iam_role" "lambda_role" {
  name = "muninn-reporter-lambda-role-${var.environment}"  # was: muninn-reporter-lambda-role

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

  tags = {
    Project     = "muninn"
    Part        = "agents"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "lambda_agents_policy" {
  name = "muninn-reports-lambda-policy-${var.environment}"  # was: muninn-reports-lambda-policy
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.analysis_jobs.arn
      },
      {
        Effect = "Allow"
        Action = [
          "rds-data:ExecuteStatement",
          "rds-data:BatchExecuteStatement",
          "rds-data:BeginTransaction",
          "rds-data:CommitTransaction",
          "rds-data:RollbackTransaction"
        ]
        Resource = var.aurora_cluster_arn
      },
      {
        Effect   = "Allow"                          # FIXED: removed duplicate block below this
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.aurora_secret_arn
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_agents_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "reporter" {
  function_name = "muninn-reporter-${var.environment}"  # was: muninn-reporter
  role          = aws_iam_role.lambda_role.arn

  s3_bucket        = aws_s3_bucket.lambda_packages.id
  s3_key           = aws_s3_object.lambda_packages["reporter"].key
  source_code_hash = fileexists("${path.module}/../../backend/reporter/reporter_lambda.zip") ? filebase64sha256("${path.module}/../../backend/reporter/reporter_lambda.zip") : null

  handler     = "lambda_handler.lambda_handler"
  runtime     = "python3.12"
  timeout     = 60
  memory_size = 2048

  environment {
    variables = {
      AURORA_CLUSTER_ARN = var.aurora_cluster_arn
      AURORA_SECRET_ARN  = var.aurora_secret_arn
      DATABASE_NAME      = "muninn"
      BEDROCK_MODEL_ID   = var.bedrock_model_id
      BEDROCK_REGION     = var.bedrock_region
      DEFAULT_AWS_REGION = var.aws_region
      OPENAI_API_KEY     = var.openai_api_key
      ENVIRONMENT        = var.environment
      SENDGRID_API_KEY   = var.sendgrid_api_key
      
    }
  }

  tags = {
    Project     = "muninn"
    Part        = "agents"
    Environment = var.environment
  }
}

resource "aws_lambda_event_source_mapping" "reporter_sqs" {
  event_source_arn = aws_sqs_queue.analysis_jobs.arn
  function_name    = aws_lambda_function.reporter.arn
  batch_size       = 1
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/muninn-reporter-${var.environment}"  # was: /aws/lambda/muninn-reporter
  retention_in_days = 7

  tags = {
    Project     = "muninn"
    Part        = "agents"
    Environment = var.environment
  }
}