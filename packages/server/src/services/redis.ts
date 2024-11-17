import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;

export async function setupRedis() {
  redisClient = createClient({
    url: process.env.REDIS_URL
  }) as RedisClientType;

  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  await redisClient.connect();
  return redisClient;
}

export async function getTunnelConnection(tunnelId: string): Promise<string | null> {
  return redisClient.get(`tunnel:${tunnelId}`);
}

export async function setTunnelConnection(tunnelId: string, clientId: string): Promise<void> {
  await redisClient.set(`tunnel:${tunnelId}`, clientId);
}

export async function removeTunnelConnection(tunnelId: string): Promise<void> {
  await redisClient.del(`tunnel:${tunnelId}`);
}
