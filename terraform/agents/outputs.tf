output "sqs_queue_url" {
  description = "URL of the SQS queue for job submission"
  value       = aws_sqs_queue.analysis_jobs.url
}

output "sqs_queue_arn" {
  description = "ARN of the SQS queue"
  value       = aws_sqs_queue.analysis_jobs.arn
}

output "lambda_function" {
  description = "Name of deployed Lambda function"
  value = {
    reporter   = aws_lambda_function.reporter.function_name
  }
}

output "setup_instructions" {
  description = "Instructions for testing the agents"
  value = <<-EOT
    
    ✅ Agent infrastructure deployed successfully!
    
    Lambda lambda_function:
    - Reporter: ${aws_lambda_function.reporter.function_name}
    
    SQS Queue: ${aws_sqs_queue.analysis_jobs.name}
    
    To test the system:
    1. First, package and deploy each agent's code:
       cd backend/reporter && uv run package_docker.py --deploy
    
    2. Run the full integration test:
       cd backend/reporter
       uv run run_full_test.py
    
    3. Monitor progress in CloudWatch Logs:
       - /aws/lambda/alex-reporter
    
    Bedrock Model: ${var.bedrock_model_id}
    Region: ${var.bedrock_region}
  EOT
}