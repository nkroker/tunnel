import WebSocket from 'ws';

export interface ExtendedWebSocket extends WebSocket {
  id: string;
  isAlive: boolean;
  tunnelId?: string;
}
