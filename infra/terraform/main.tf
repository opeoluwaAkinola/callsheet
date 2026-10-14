data "aws_caller_identity" "current" {}

locals {
  name   = "callsheet-${var.environment}"
  bucket = "${local.name}-callsheets-${data.aws_caller_identity.current.account_id}"
}

# ---------------------------------------------------------------------------
# Call sheet bucket: the gateway writes JSON here; the Lambda writes PDFs back.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "callsheets" {
  bucket        = local.bucket
  force_destroy = var.environment != "prod"
}

resource "aws_s3_bucket_public_access_block" "callsheets" {
  bucket                  = aws_s3_bucket.callsheets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "callsheets" {
  bucket = aws_s3_bucket.callsheets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "callsheets" {
  bucket = aws_s3_bucket.callsheets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "callsheets" {
  bucket = aws_s3_bucket.callsheets.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# ---------------------------------------------------------------------------
# PDF rendering Lambda
# ---------------------------------------------------------------------------
data "archive_file" "callsheet_pdf" {
  type        = "zip"
  source_dir  = var.lambda_source_dir
  output_path = "${path.module}/.build/callsheet-pdf.zip"
}

resource "aws_cloudwatch_log_group" "callsheet_pdf" {
  name              = "/aws/lambda/${local.name}-callsheet-pdf"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "callsheet_pdf" {
  name               = "${local.name}-callsheet-pdf"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# Least privilege: read JSON and write PDFs under callsheets/, write its own logs and traces, optionally send email.
data "aws_iam_policy_document" "callsheet_pdf" {
  statement {
    sid       = "ReadCallSheets"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.callsheets.arn}/callsheets/*.json"]
  }
  statement {
    sid       = "WritePdfs"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.callsheets.arn}/callsheets/*.pdf"]
  }
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.callsheet_pdf.arn}:*"]
  }
  statement {
    sid       = "Tracing"
    actions   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
    resources = ["*"]
  }
  dynamic "statement" {
    for_each = var.sender_email == "" ? [] : [1]
    content {
      sid       = "SendEmail"
      actions   = ["ses:SendEmail"]
      resources = ["*"]
      condition {
        test     = "StringEquals"
        variable = "ses:FromAddress"
        values   = [var.sender_email]
      }
    }
  }
}

resource "aws_iam_role_policy" "callsheet_pdf" {
  role   = aws_iam_role.callsheet_pdf.id
  policy = data.aws_iam_policy_document.callsheet_pdf.json
}

resource "aws_lambda_function" "callsheet_pdf" {
  function_name    = "${local.name}-callsheet-pdf"
  role             = aws_iam_role.callsheet_pdf.arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "src/handler.handler"
  filename         = data.archive_file.callsheet_pdf.output_path
  source_code_hash = data.archive_file.callsheet_pdf.output_base64sha256
  memory_size      = 512
  timeout          = 30

  environment {
    variables = {
      SENDER_EMAIL = var.sender_email
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [aws_cloudwatch_log_group.callsheet_pdf, aws_iam_role_policy.callsheet_pdf]
}

resource "aws_lambda_permission" "s3_invoke" {
  statement_id   = "AllowS3Invoke"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.callsheet_pdf.function_name
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.callsheets.arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_s3_bucket_notification" "callsheets" {
  bucket = aws_s3_bucket.callsheets.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.callsheet_pdf.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "callsheets/"
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.s3_invoke]
}

resource "aws_cloudwatch_metric_alarm" "callsheet_pdf_errors" {
  alarm_name          = "${local.name}-callsheet-pdf-errors"
  alarm_description   = "Call sheet PDF rendering is failing."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.callsheet_pdf.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
}

# ---------------------------------------------------------------------------
# Container registries for the services that run on Kubernetes
# ---------------------------------------------------------------------------
resource "aws_ecr_repository" "service" {
  for_each             = var.services
  name                 = "callsheet/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = var.environment != "prod"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "service" {
  for_each   = aws_ecr_repository.service
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 20 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }
      action       = { type = "expire" }
    }]
  })
}

# ---------------------------------------------------------------------------
# Least-privilege policy for the gateway's pods (attach via EKS Pod Identity / IRSA).
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "gateway_publish" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.callsheets.arn}/callsheets/*.json"]
  }
}

resource "aws_iam_policy" "gateway_publish" {
  name   = "${local.name}-gateway-publish"
  policy = data.aws_iam_policy_document.gateway_publish.json
}
