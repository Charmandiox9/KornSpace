import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { Transform, type Readable } from 'node:stream';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { PrismaService } from '../prisma/prisma.service';
import type { ProcessFileMessage, StoredFileResponse, UploadFileResult } from './file.types';

const defaultAsyncThresholdBytes = 10 * 1024 * 1024;
const defaultMaxFileSizeBytes = 100 * 1024 * 1024;

interface FileStorageConfiguration {
  endpoint: string;
  bucket: string;
  queueUrl: string;
  region: string;
  asyncThresholdBytes: number;
  maxFileSizeBytes: number;
}

interface FileStreamMetadata {
  stream: Transform;
  checksum: () => string;
}

@Injectable()
export class FilesService {
  private readonly configuration: FileStorageConfiguration;
  private readonly s3: S3Client;
  private readonly sqs: SQSClient;

  constructor(private readonly prisma: PrismaService) {
    this.configuration = {
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:4566',
      bucket: process.env.S3_BUCKET ?? 'kornspace-files',
      queueUrl: process.env.SQS_QUEUE_URL ?? 'http://localhost:4566/000000000000/kornspace-file-processing',
      region: process.env.AWS_REGION ?? 'us-east-1',
      asyncThresholdBytes: this.readPositiveInteger('FILE_ASYNC_THRESHOLD_BYTES', defaultAsyncThresholdBytes),
      maxFileSizeBytes: this.readPositiveInteger('FILE_MAX_SIZE_BYTES', defaultMaxFileSizeBytes),
    };
    const clientConfiguration = {
      endpoint: this.configuration.endpoint,
      region: this.configuration.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      },
    };
    this.s3 = new S3Client(clientConfiguration);
    this.sqs = new SQSClient({
      ...clientConfiguration,
      endpoint: process.env.SQS_ENDPOINT ?? this.configuration.endpoint,
    });
  }

  async list(ownerId: string): Promise<StoredFileResponse[]> {
    const files = await this.prisma.storedFile.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
    return files.map((file) => this.toResponse(file));
  }

  async upload(
    source: Readable,
    name: string,
    contentType: string,
    sizeBytes: number,
    ownerId: string,
  ): Promise<UploadFileResult> {
    this.validateUpload(name, contentType, sizeBytes);
    const id = randomUUID();
    const s3Key = `files/${id}`;
    const streamMetadata = this.createHashingStream(source);

    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.configuration.bucket,
        Key: s3Key,
        Body: streamMetadata.stream,
        ContentLength: sizeBytes,
        ContentType: contentType,
      }));

      const asynchronous = sizeBytes > this.configuration.asyncThresholdBytes;
      const file = await this.prisma.storedFile.create({
        data: {
          id,
          name,
          contentType,
          sizeBytes: BigInt(sizeBytes),
          s3Key,
          ownerId,
          checksum: asynchronous ? null : streamMetadata.checksum(),
          status: asynchronous ? 'PROCESSING' : 'AVAILABLE',
        },
      });

      if (asynchronous) {
        const message: ProcessFileMessage = { fileId: id, s3Key };
        try {
          await this.sqs.send(new SendMessageCommand({
            QueueUrl: this.configuration.queueUrl,
            MessageBody: JSON.stringify(message),
          }));
        } catch {
          await this.prisma.storedFile.delete({ where: { id } });
          await this.s3.send(new DeleteObjectCommand({ Bucket: this.configuration.bucket, Key: s3Key }));
          throw new ServiceUnavailableException('No fue posible programar el procesamiento del archivo.');
        }
      }

      return { file: this.toResponse(file), asynchronous };
    } catch (error: unknown) {
      if (error instanceof BadRequestException || error instanceof PayloadTooLargeException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('No fue posible guardar el archivo en el almacenamiento.');
    }
  }

  async getDownload(id: string, ownerId: string): Promise<{ file: StoredFileResponse; body: Readable }> {
    const file = await this.prisma.storedFile.findFirst({ where: { id, ownerId } });
    if (!file) {
      throw new NotFoundException('No se encontró el archivo solicitado.');
    }
    if (file.status !== 'AVAILABLE') {
      throw new ServiceUnavailableException('El archivo todavía no está disponible.');
    }

    const result = await this.s3.send(new GetObjectCommand({
      Bucket: this.configuration.bucket,
      Key: file.s3Key,
    }));
    if (!result.Body || !('pipe' in result.Body)) {
      throw new ServiceUnavailableException('El almacenamiento no devolvió el contenido del archivo.');
    }
    return { file: this.toResponse(file), body: result.Body as Readable };
  }

  async getStatus(id: string, ownerId: string): Promise<StoredFileResponse> {
    const file = await this.prisma.storedFile.findFirst({ where: { id, ownerId } });
    if (!file) {
      throw new NotFoundException('No se encontró el archivo solicitado.');
    }
    return this.toResponse(file);
  }

  private validateUpload(name: string, contentType: string, sizeBytes: number): void {
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 255 || /[\u0000-\u001f]/u.test(normalizedName)) {
      throw new BadRequestException('El nombre del archivo no es válido.');
    }
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
      throw new BadRequestException('El archivo debe indicar un tamaño válido.');
    }
    if (sizeBytes > this.configuration.maxFileSizeBytes) {
      throw new PayloadTooLargeException(`El tamaño máximo permitido es ${this.configuration.maxFileSizeBytes} bytes.`);
    }
    if (!contentType || contentType.length > 255 || /[\r\n]/u.test(contentType)) {
      throw new BadRequestException('El tipo de contenido no es válido.');
    }
  }

  private createHashingStream(source: Readable): FileStreamMetadata {
    const hash = createHash('sha256');
    const stream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    source.pipe(stream);
    return { stream, checksum: () => hash.digest('hex') };
  }

  private toResponse(file: {
    id: string;
    name: string;
    contentType: string;
    sizeBytes: bigint;
    status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
    checksum: string | null;
    createdAt: Date;
  }): StoredFileResponse {
    return {
      id: file.id,
      name: file.name,
      contentType: file.contentType,
      sizeBytes: Number(file.sizeBytes),
      status: file.status,
      checksum: file.checksum,
      createdAt: file.createdAt.toISOString(),
    };
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const parsed = Number(process.env[name]);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
