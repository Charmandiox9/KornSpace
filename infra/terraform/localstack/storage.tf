resource "aws_s3_bucket" "files" {
  bucket        = "kornspace-files"
  force_destroy = true

  tags = {
    Application = "KornSpace"
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_sqs_queue" "file_processing" {
  name                       = "kornspace-file-processing"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400

  tags = {
    Application = "KornSpace"
    ManagedBy   = "Terraform"
  }
}
