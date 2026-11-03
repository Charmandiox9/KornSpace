import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

export type UploadPhase = 'uploading' | 'confirming' | 'cancelling' | 'cleanupPending' | 'cancelled' | 'completed' | 'failed';
export interface UploadRecord {
  operationId: string;
  ownerId: string;
  fileId: string;
  phase: UploadPhase;
  asynchronous: boolean;
  leaseUntil: number;
  cleanupOutcome: 'cancelled' | 'failed';
}

const pendingIndex = 'kornspace:pending-file-uploads';
const terminalTtlSeconds = 86400;
export const uploadLeaseMs = 90000;
const phases: UploadPhase[] = ['uploading', 'confirming', 'cancelling', 'cleanupPending', 'cancelled', 'completed', 'failed'];
const isTerminal = (phase: UploadPhase) => phase === 'cancelled' || phase === 'completed' || phase === 'failed';

@Injectable()
export class UploadRegistryService {
  constructor(private readonly redis: RedisService) {}

  private key(ownerId: string, operationId: string): string {
    return `kornspace:file-upload:${ownerId}:${operationId}`;
  }

  private parse(raw: string): UploadRecord {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) throw new Error('Invalid upload record');
    const record = value as Record<string, unknown>;
    if (typeof record.operationId !== 'string' || typeof record.ownerId !== 'string' || typeof record.fileId !== 'string'
      || !phases.includes(record.phase as UploadPhase) || typeof record.asynchronous !== 'boolean'
      || typeof record.leaseUntil !== 'number' || !['cancelled', 'failed'].includes(String(record.cleanupOutcome))) {
      throw new Error('Invalid upload record');
    }
    return value as UploadRecord;
  }

  async get(ownerId: string, operationId: string): Promise<UploadRecord | null> {
    const raw = await this.redis.get(this.key(ownerId, operationId));
    return raw ? this.parse(raw) : null;
  }

  async begin(ownerId: string, operationId: string, asynchronous: boolean): Promise<UploadRecord> {
    const record: UploadRecord = {
      ownerId, operationId, asynchronous, fileId: randomUUID(), phase: 'uploading',
      leaseUntil: Date.now() + uploadLeaseMs, cleanupOutcome: 'failed',
    };
    if (!await this.redis.createIndexedRecord(this.key(ownerId, operationId), pendingIndex, JSON.stringify(record), 0)) {
      throw new ConflictException('Esta operación de carga ya existe. Consulta su estado antes de reintentar.');
    }
    return record;
  }

  async update(ownerId: string, operationId: string, change: (record: UploadRecord) => UploadRecord): Promise<UploadRecord> {
    const key = this.key(ownerId, operationId);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const raw = await this.redis.get(key);
      if (!raw) throw new ServiceUnavailableException('No se encontró el registro de la carga.');
      const previous = this.parse(raw);
      const next = change(previous);
      if (next === previous) return previous;
      if (await this.redis.replaceIndexedRecord(key, pendingIndex, raw, JSON.stringify(next), isTerminal(next.phase) ? terminalTtlSeconds : 0)) return next;
    }
    throw new ServiceUnavailableException('No fue posible actualizar el estado de la carga.');
  }

  async requestCancellation(ownerId: string, operationId: string): Promise<UploadRecord> {
    // A tombstone also cancels an upload whose POST has not reached this process yet.
    const record: UploadRecord = {
      ownerId, operationId, fileId: randomUUID(), phase: 'cancelled', asynchronous: false,
      leaseUntil: 0, cleanupOutcome: 'cancelled',
    };
    if (await this.redis.createIndexedRecord(this.key(ownerId, operationId), pendingIndex, JSON.stringify(record), terminalTtlSeconds)) return record;
    return this.update(ownerId, operationId, (current) => current.phase === 'uploading'
      ? { ...current, phase: 'cancelling', cleanupOutcome: 'cancelled' } : current);
  }

  async pending(): Promise<UploadRecord[]> {
    const keys = await this.redis.indexedRecords(pendingIndex, 100);
    const records = await Promise.all(keys.map((key) => this.redis.get(key)));
    return records.filter((raw): raw is string => raw !== null).map((raw) => this.parse(raw));
  }
}
