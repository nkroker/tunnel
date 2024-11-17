import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const ConfigSchema = z.object({
  serverUrl: z.string().url(),
  localPort: z.number().min(1).max(65535),
  tunnelId: z.string(),
  encryptionKey: z.string().min(32),
  maxReconnectAttempts: z.number().min(1).default(5),
  heartbeatInterval: z.number().min(1000).default(30000),
  authToken: z.string().optional(),
});

export type ClientConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath?: string): ClientConfig {
  if (configPath) {
    dotenv.config({ path: path.resolve(configPath) });
  } else {
    dotenv.config();
  }

  return ConfigSchema.parse({
    serverUrl: process.env.TUNNEL_SERVER_URL,
    localPort: parseInt(process.env.LOCAL_PORT || '3000', 10),
    tunnelId: process.env.TUNNEL_ID,
    encryptionKey: process.env.ENCRYPTION_KEY,
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '5', 10),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    authToken: process.env.AUTH_TOKEN,
  });
}

export interface Config {
  serverUrl: string;
  localPort: number;
  tunnelId: string;
  encryptionKey: string;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  authToken?: string;
}

export interface CliConfig extends Config {
  compressionThreshold?: number;
  requestTimeout?: number;
}
