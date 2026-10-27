import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import type { StoredFileResponse, UploadFileResult } from '../src/files/file.types';

test('file REST endpoints expose upload, listing, and processing status', async () => {
  const file: StoredFileResponse = {
    id: 'a8120cf2-69df-4f51-a80a-ec44fe2120a1',
    name: 'large.txt',
    contentType: 'text/plain',
    sizeBytes: 11 * 1024 * 1024,
    status: 'PROCESSING',
    checksum: null,
    createdAt: '2026-10-27T12:00:00.000Z',
  };
  const availableFile: StoredFileResponse = {
    ...file,
    sizeBytes: 4,
    status: 'AVAILABLE',
    checksum: 'abc123',
  };
  let receivedName = '';
  const filesServiceStub: Pick<FilesService, 'list' | 'upload' | 'getStatus' | 'getDownload'> = {
    list: async () => [file],
    upload: async (_source, name): Promise<UploadFileResult> => {
      receivedName = name;
      return { file, asynchronous: true };
    },
    getStatus: async () => file,
    getDownload: async () => ({ file: availableFile, body: Readable.from('file') }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [FilesController],
    providers: [{ provide: FilesService, useValue: filesServiceStub }],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');

  try {
    const serverAddress = app.getHttpServer().address();
    assert.ok(serverAddress && typeof serverAddress !== 'string');
    const address: AddressInfo = serverAddress;
    const baseUrl = `http://127.0.0.1:${address.port}/api/files`;
    const uploadResponse = await fetch(`${baseUrl}?name=large.txt`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'large file contents',
    });
    const uploadPayload: unknown = await uploadResponse.json();
    assert.equal(uploadResponse.status, 202);
    assert.equal(receivedName, 'large.txt');
    assert.deepEqual(uploadPayload, { file, asynchronous: true });

    const listResponse = await fetch(baseUrl);
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), [file]);

    const statusResponse = await fetch(`${baseUrl}/${file.id}/status`);
    assert.equal(statusResponse.status, 200);
    assert.deepEqual(await statusResponse.json(), file);

    const downloadResponse = await fetch(`${baseUrl}/${file.id}`);
    assert.equal(downloadResponse.status, 200);
    assert.equal(downloadResponse.headers.get('content-type'), 'text/plain');
    assert.equal(await downloadResponse.text(), 'file');
  } finally {
    await app.close();
  }
});
