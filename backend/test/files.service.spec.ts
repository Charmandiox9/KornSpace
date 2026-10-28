import { strict as assert } from 'node:assert';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { FilesService } from '../src/files/files.service';
import { PrismaService } from '../src/prisma/prisma.service';

function createFilesService(): FilesService {
  const prismaStub = {} as PrismaService;
  return new FilesService(prismaStub);
}

test('FilesService rejects an empty filename before accessing storage', async () => {
  const service = createFilesService();
  const source = new PassThrough();
  const request = service.upload(source, '  ', 'text/plain', 1, 'user-1');

  await assert.rejects(request, BadRequestException);
  source.destroy();
});

test('FilesService rejects files larger than the configured maximum', async () => {
  const service = createFilesService();
  const source = new PassThrough();
  const request = service.upload(source, 'large.bin', 'application/octet-stream', 100 * 1024 * 1024 + 1, 'user-1');

  await assert.rejects(request, PayloadTooLargeException);
  source.destroy();
});
