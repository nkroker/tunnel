import { z } from 'zod';
import { IncomingHttpHeaders } from 'http';

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

export interface WSMessage {
  type: WSMessageType;
  tunnelId: string;
  payload: ProxyRequest | ProxyResponse | any;
  timestamp: number;
}

export interface TunnelOptions {
  hostname?: string;  // Base hostname for the tunnel (default: localtest.me)
  subdomain?: string; // Custom subdomain (optional)
}

// Base ProxyRequest interface
export interface ProxyRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body?: string;
  requestId: string;
}

// Extended interface for internal use with retry count
export interface ProxyRequestWithRetry extends ProxyRequest {
  retryCount: number;
}

export interface ProxyResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
  requestId?: string;
}
