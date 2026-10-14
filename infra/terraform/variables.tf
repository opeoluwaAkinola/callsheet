variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name, used in resource names (e.g. dev, staging, prod)."
  type        = string
  default     = "dev"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,15}$", var.environment))
    error_message = "environment must be 2-16 lowercase letters, digits or dashes."
  }
}

variable "sender_email" {
  description = "Verified SES identity used to email call sheets. Leave empty to skip email and only render PDFs."
  type        = string
  default     = ""
}

variable "lambda_source_dir" {
  description = "Directory containing the built Lambda (run `npm run build` in functions/callsheet-pdf first)."
  type        = string
  default     = "../../functions/callsheet-pdf/dist"
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the Lambda."
  type        = number
  default     = 14
}

variable "services" {
  description = "Container images that get an ECR repository."
  type        = set(string)
  default     = ["scheduling-service", "crew-service", "gateway", "web"]
}
