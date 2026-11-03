import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  getAndDelete(key: string): Promise<string | null> {
    return this.client.getdel(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(key, ttlSeconds)) === 1;
  }

  async createIndexedRecord(key: string, index: string, value: string, terminalTtl: number): Promise<boolean> {
    return (await this.client.eval(`
      if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
      redis.call('SET', KEYS[1], ARGV[1])
      if tonumber(ARGV[2]) > 0 then redis.call('EXPIRE', KEYS[1], ARGV[2])
      else redis.call('SADD', KEYS[2], KEYS[1]) end
      return 1
    `, 2, key, index, value, terminalTtl)) === 1;
  }

  async replaceIndexedRecord(key: string, index: string, expected: string, value: string, terminalTtl: number): Promise<boolean> {
    return (await this.client.eval(`
      if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
      redis.call('SET', KEYS[1], ARGV[2])
      if tonumber(ARGV[3]) > 0 then
        redis.call('EXPIRE', KEYS[1], ARGV[3])
        redis.call('SREM', KEYS[2], KEYS[1])
      else redis.call('SADD', KEYS[2], KEYS[1]) end
      return 1
    `, 2, key, index, expected, value, terminalTtl)) === 1;
  }

  indexedRecords(index: string, count: number): Promise<string[]> {
    return this.client.srandmember(index, count);
  }
}
