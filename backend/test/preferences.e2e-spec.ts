import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { PreferencesController } from '../src/preferences/preferences.controller';
import { PreferencesService } from '../src/preferences/preferences.service';
import { SessionJwtGuard } from '../src/auth/session-jwt.guard';
import { preferencesHarness } from './preferences.harness';

test('preference HTTP endpoints validate input, authenticate, isolate users and preserve other settings', async () => {
  const h = preferencesHarness();
  h.folderGrants.set(h.rootId + ':peer', 'READER');
  const moduleRef = await Test.createTestingModule({ controllers: [PreferencesController], providers: [{ provide: PreferencesService, useValue: h.preferences }] })
    .overrideGuard(SessionJwtGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { headers: Record<string, string>; authContext?: { userId: string } } } }) => { const req = context.switchToHttp().getRequest(); if (!req.headers['x-user']) throw new UnauthorizedException(); req.authContext = { userId: req.headers['x-user'] }; return true; } }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  try {
    const url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/preferences/items`;
    const put = (body: object, user = 'peer', kind = 'files', id = h.fileId) => fetch(`${url}/${kind}/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-user': user }, body: JSON.stringify(body) });
    assert.equal((await fetch(url)).status, 401);
    for (const body of [{ color: 'INVALID' }, { starred: 'true' }, { shortcut: null }, { userId: 'owner', starred: true }]) assert.equal((await put(body)).status, 400);
    assert.equal((await put({ color: 'BLUE', starred: true })).status, 204);
    assert.equal((await put({ shortcut: true })).status, 204);
    assert.equal((await put({ color: 'VIOLET' }, 'peer', 'folders', h.childId)).status, 204);
    const list = await fetch(url, { headers: { 'x-user': 'peer' } });
    const rows = await list.json() as Array<{ kind: string; shortcut: boolean; color: string }>;
    assert.equal(rows.find((row) => row.kind === 'files')?.color, 'BLUE');
    assert.equal(rows.find((row) => row.kind === 'files')?.shortcut, true);
    assert.deepEqual(await (await fetch(url, { headers: { 'x-user': 'owner' } })).json(), []);
    assert.equal((await put({ starred: true }, 'stranger')).status, 404);
    h.fail(true);
    assert.equal((await put({ color: 'RED' })).status, 503);
    h.fail(false); h.folderGrants.clear();
    assert.deepEqual(await (await fetch(url, { headers: { 'x-user': 'peer' } })).json(), []);
  } finally { await app.close(); }
});
