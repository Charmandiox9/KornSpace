import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { RedisService } from '../redis/redis.service';
import { accessCookieName, createSessionKey, jwtAudience, jwtIssuer, sessionCookieName } from '../auth/auth.constants';
import type { AccessTokenPayload, AuthSessionRecord } from '../auth/auth.types';

interface FileStatusEvent {
  type: 'file.status';
  fileId: string;
  status: 'AVAILABLE' | 'FAILED';
}

@Injectable()
export class FileEventsGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileEventsGateway.name);
  private readonly clients = new Map<string, Set<WebSocket>>();
  private readonly server = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  private httpServer?: Server;

  constructor(private readonly adapterHost: HttpAdapterHost, private readonly jwt: JwtService, private readonly redis: RedisService) {}

  onModuleInit(): void {
    this.httpServer = this.adapterHost.httpAdapter.getHttpServer() as Server;
    this.httpServer.on('upgrade', this.handleUpgrade);
  }

  onModuleDestroy(): void {
    this.httpServer?.off('upgrade', this.handleUpgrade);
    this.clients.clear();
    this.server.close();
  }

  publishFileStatus(userId: string, fileId: string, status: 'AVAILABLE' | 'FAILED'): void {
    const payload: FileStatusEvent = { type: 'file.status', fileId, status };
    const encoded = JSON.stringify(payload);
    for (const client of this.clients.get(userId) ?? []) {
      if (client.readyState === WebSocket.OPEN) client.send(encoded);
    }
  }

  private readonly handleUpgrade = (request: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer): void => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname !== '/api/files/events') return;
    void this.accept(request, socket, head);
  };

  private async accept(request: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer): Promise<void> {
    try {
      if (!this.isAllowedOrigin(request.headers.origin)) { socket.destroy(); return; }
      const cookies = this.parseCookies(request.headers.cookie ?? '');
      const accessToken = cookies.get(accessCookieName);
      const sessionId = cookies.get(sessionCookieName);
      const secret = process.env.JWT_SECRET;
      if (!accessToken || !sessionId || !secret || Buffer.byteLength(secret, 'utf8') < 32) { socket.destroy(); return; }
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(accessToken, {
        secret, algorithms: ['HS256'], issuer: jwtIssuer, audience: jwtAudience,
      });
      if (typeof payload.sub !== 'string' || payload.sid !== sessionId || typeof payload.jti !== 'string') { socket.destroy(); return; }
      const raw = await this.redis.get(createSessionKey(sessionId));
      const session = this.parseSession(raw);
      if (!session || session.userId !== payload.sub || session.jwtId !== payload.jti) { socket.destroy(); return; }
      this.server.handleUpgrade(request, socket, head, (client) => {
        const userClients = this.clients.get(session.userId) ?? new Set<WebSocket>();
        userClients.add(client);
        this.clients.set(session.userId, userClients);
        client.on('close', () => {
          userClients.delete(client);
          if (!userClients.size) this.clients.delete(session.userId);
        });
      });
    } catch (error: unknown) {
      this.logger.warn(`Rejected file event connection: ${error instanceof Error ? error.message : 'authentication failed'}`);
      socket.destroy();
    }
  }

  private isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return false;
    const configured = (process.env.FRONTEND_ORIGIN ?? 'http://localhost')
      .split(',').map((value) => value.trim()).filter(Boolean);
    const development = process.env.NODE_ENV === 'development'
      ? ['http://localhost:3001', 'http://127.0.0.1:3001'] : [];
    return [...configured, ...development].includes(origin);
  }

  private parseCookies(header: string): Map<string, string> {
    const result = new Map<string, string>();
    for (const part of header.split(';')) {
      const index = part.indexOf('=');
      if (index < 0) continue;
      try { result.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())); } catch { /* Ignore malformed cookies. */ }
    }
    return result;
  }

  private parseSession(value: string | null): AuthSessionRecord | null {
    if (!value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const record = parsed as Record<string, unknown>;
      if (typeof record.userId !== 'string' || typeof record.jwtId !== 'string' || typeof record.createdAt !== 'number') return null;
      return { userId: record.userId, jwtId: record.jwtId, createdAt: record.createdAt };
    } catch { return null; }
  }
}
