output "callsheet_bucket" {
  description = "Set as CALLSHEET_BUCKET on the gateway."
  value       = aws_s3_bucket.callsheets.bucket
}

output "lambda_function_name" {
  value = aws_lambda_function.callsheet_pdf.function_name
}

output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.service : k => r.repository_url }
}

output "gateway_publish_policy_arn" {
  description = "Attach to the gateway's Kubernetes service account."
  value       = aws_iam_policy.gateway_publish.arn
}
