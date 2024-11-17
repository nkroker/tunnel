import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

export async function setupRedis() {
  redisClient.on('error', (err) => logger.error('Redis Client Error', err));
  await redisClient.connect();
  logger.info('Redis connected');
  return redisClient;
}

export async function getTunnelConnection(tunnelId: string) {
  return redisClient.get(`tunnel:${tunnelId}`);
}

export async function setTunnelConnection(tunnelId: string, wsId: string) {
  await redisClient.set(`tunnel:${tunnelId}`, wsId);
  await redisClient.expire(`tunnel:${tunnelId}`, 3600); // 1 hour TTL
}

export async function removeTunnelConnection(tunnelId: string) {
  await redisClient.del(`tunnel:${tunnelId}`);
}

export { redisClient };
