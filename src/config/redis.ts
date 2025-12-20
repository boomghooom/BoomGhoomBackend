import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from '../shared/utils/logger.js';

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  private constructor() {}

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  async connect(): Promise<void> {
    if (this.client) {
      logger.info('Redis already connected');
      return;
    }

    const redisOptions: Redis.RedisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    try {
      this.client = new Redis(redisOptions);
      this.subscriber = new Redis(redisOptions);
      this.publisher = new Redis(redisOptions);

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('error', (error) => {
        logger.error('Redis client error:', error);
      });

      this.client.on('close', () => {
        logger.warn('Redis client connection closed');
      });

      await this.client.connect();
      await this.subscriber.connect();
      await this.publisher.connect();

      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
      }
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }
      if (this.publisher) {
        await this.publisher.quit();
        this.publisher = null;
      }
      logger.info('Redis disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  getSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized. Call connect() first.');
    }
    return this.subscriber;
  }

  getPublisher(): Redis {
    if (!this.publisher) {
      throw new Error('Redis publisher not initialized. Call connect() first.');
    }
    return this.publisher;
  }

  // Cache utilities
  async get<T>(key: string): Promise<T | null> {
    const client = this.getClient();
    const value = await client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    const client = this.getClient();
    await client.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const client = this.getClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    return (await client.exists(key)) === 1;
  }

  async incr(key: string): Promise<number> {
    const client = this.getClient();
    return await client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const client = this.getClient();
    await client.expire(key, ttlSeconds);
  }

  // Hash utilities
  async hget<T>(key: string, field: string): Promise<T | null> {
    const client = this.getClient();
    const value = await client.hget(key, field);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async hset(key: string, field: string, value: unknown): Promise<void> {
    const client = this.getClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await client.hset(key, field, serialized);
  }

  async hdel(key: string, field: string): Promise<void> {
    const client = this.getClient();
    await client.hdel(key, field);
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const client = this.getClient();
    const data = await client.hgetall(key);
    const result: Record<string, T> = {};
    for (const [field, value] of Object.entries(data)) {
      try {
        result[field] = JSON.parse(value) as T;
      } catch {
        result[field] = value as unknown as T;
      }
    }
    return result;
  }

  // Set utilities
  async sadd(key: string, ...members: string[]): Promise<number> {
    const client = this.getClient();
    return await client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const client = this.getClient();
    return await client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    const client = this.getClient();
    return await client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const client = this.getClient();
    return (await client.sismember(key, member)) === 1;
  }
}

export const redisClient = RedisClient.getInstance();

