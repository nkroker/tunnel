import { z } from 'zod';

// Core types with Zod validation
export const TunnelConfigSchema = z.object({
  subdomain: z.string().optional(),
  port: z.number().min(1).max(65535),
  protocol: z.enum(['http', 'https']),
});

export const TunnelConnectionSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  config: TunnelConfigSchema,
  createdAt: z.date(),
  status: z.enum(['active', 'inactive']),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Export types
export type TunnelConfig = z.infer<typeof TunnelConfigSchema>;
export type TunnelConnection = z.infer<typeof TunnelConnectionSchema>;
export type User = z.infer<typeof UserSchema>;

// WebSocket message types
export enum WSMessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  REQUEST = 'request',
  RESPONSE = 'response',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

export const WSMessageSchema = z.object({
  type: z.nativeEnum(WSMessageType),
  tunnelId: z.string().uuid(),
  payload: z.any(),
  timestamp: z.number(),
});

export type WSMessage = z.infer<typeof WSMessageSchema>;
