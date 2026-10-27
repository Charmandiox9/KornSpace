output "bucket_name" {
  description = "Bucket usado para el contenido de los archivos de KornSpace."
  value       = aws_s3_bucket.files.bucket
}

output "s3_endpoint" {
  description = "Endpoint S3 de LocalStack accesible desde los contenedores."
  value       = var.localstack_endpoint
}

output "file_processing_queue_url" {
  description = "Cola SQS para procesar archivos grandes en segundo plano."
  value       = aws_sqs_queue.file_processing.url
}
