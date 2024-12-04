import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let client: RedisClientType;

export async function setupRedis(): Promise<void> {
  try {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err: Error) => {
      logger.error('Redis Client Error:', err);
    });

    await client.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export function getRedisClient(): RedisClientType {
  if (!client) {
    throw new Error('Redis client not initialized');
  }
  return client;
}

export async function getTunnelConnection(tunnelId: string): Promise<string | null> {
  return client.get(`tunnel:${tunnelId}`);
}

export async function setTunnelConnection(tunnelId: string, clientId: string): Promise<void> {
  await client.set(`tunnel:${tunnelId}`, clientId);
}

export async function removeTunnelConnection(tunnelId: string): Promise<void> {
  await client.del(`tunnel:${tunnelId}`);
}
