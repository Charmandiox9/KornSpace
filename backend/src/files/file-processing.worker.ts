import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { PrismaService } from '../prisma/prisma.service';
import type { ProcessFileMessage } from './file.types';

@Injectable()
export class FileProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileProcessingWorker.name);
  private readonly s3: S3Client;
  private readonly sqs: SQSClient;
  private readonly queueUrl = process.env.SQS_QUEUE_URL ?? 'http://localhost:4566/000000000000/kornspace-file-processing';
  private readonly bucket = process.env.S3_BUCKET ?? 'kornspace-files';
  private running = true;

  constructor(private readonly prisma: PrismaService) {
    const configuration = {
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:4566',
      region: process.env.AWS_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      },
    };
    this.s3 = new S3Client(configuration);
    this.sqs = new SQSClient({
      ...configuration,
      endpoint: process.env.SQS_ENDPOINT ?? configuration.endpoint,
    });
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV !== 'test' && process.env.SQS_QUEUE_URL) {
      void this.consume();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.s3.destroy();
    this.sqs.destroy();
  }

  private async consume(): Promise<void> {
    while (this.running) {
      try {
        const response = await this.sqs.send(new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 10,
          VisibilityTimeout: 300,
          MessageAttributeNames: ['All'],
        }));
        for (const message of response.Messages ?? []) {
          await this.processMessage(message.Body, message.ReceiptHandle);
        }
      } catch (error: unknown) {
        if (this.running) {
          this.logger.error(`File queue polling failed: ${this.errorMessage(error)}`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  private async processMessage(body: string | undefined, receiptHandle: string | undefined): Promise<void> {
    if (!body || !receiptHandle) {
      return;
    }
    try {
      const parsedMessage: unknown = JSON.parse(body);
      if (!this.isProcessFileMessage(parsedMessage)) {
        await this.sqs.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: receiptHandle }));
        this.logger.error('Removed an invalid file processing message from the queue.');
        return;
      }
      const message: ProcessFileMessage = parsedMessage;
      const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: message.s3Key }));
      if (!object.Body || !('on' in object.Body)) {
        throw new Error('S3 object body is unavailable.');
      }
      const hash = createHash('sha256');
      for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
        hash.update(chunk);
      }
      await this.prisma.storedFile.update({
        where: { id: message.fileId },
        data: { checksum: hash.digest('hex'), status: 'AVAILABLE' },
      });
      await this.sqs.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: receiptHandle }));
      this.logger.log(`File processing completed: ${message.fileId}`);
    } catch (error: unknown) {
      this.logger.error(`File processing failed: ${this.errorMessage(error)}`);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private isProcessFileMessage(value: unknown): value is ProcessFileMessage {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Record<string, unknown>;
    return typeof record.fileId === 'string' && typeof record.s3Key === 'string';
  }
}
