import WebSocket from 'ws';
import { WSMessage, WSMessageType } from '@tunnel/common';
import { logger } from '../utils/logger';
import { getTunnelConnection, setTunnelConnection, removeTunnelConnection } from '../services/redis';

interface ExtendedWebSocket extends WebSocket {
  id: string;
  tunnelId?: string;
  isAlive: boolean;
}

export function setupWebSocketServer(wss: WebSocket.Server) {
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (!ws.isAlive) {
        logger.info(`Client ${ws.id} is inactive, terminating connection`);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.send(JSON.stringify({
        type: WSMessageType.HEARTBEAT,
        tunnelId: ws.tunnelId,
        timestamp: Date.now(),
        payload: null
      }));
    });
  }, 30000);

  wss.on('connection', (ws: ExtendedWebSocket) => {
    ws.id = Math.random().toString(36).substring(7);
    ws.isAlive = true;

    logger.info(`New client connected: ${ws.id}`);

    ws.on('message', async (data: string) => {
      try {
        const message: WSMessage = JSON.parse(data);

        switch (message.type) {
          case WSMessageType.CONNECT:
            await handleConnect(ws, message);
            break;
          case WSMessageType.DISCONNECT:
            await handleDisconnect(ws, message);
            break;
          case WSMessageType.REQUEST:
            await handleRequest(ws, message);
            break;
          case WSMessageType.HEARTBEAT:
            ws.isAlive = true;
            break;
          default:
            logger.warn(`Unknown message type: ${message.type}`);
        }
      } catch (error) {
        logger.error('Error processing message:', error);
        ws.send(JSON.stringify({
          type: WSMessageType.ERROR,
          tunnelId: ws.tunnelId,
          timestamp: Date.now(),
          payload: { error: 'Invalid message format' }
        }));
      }
    });

    ws.on('close', async () => {
      logger.info(`Client disconnected: ${ws.id}`);
      if (ws.tunnelId) {
        await removeTunnelConnection(ws.tunnelId);
      }
    });
  });

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

async function handleConnect(ws: ExtendedWebSocket, message: WSMessage) {
  ws.tunnelId = message.tunnelId;
  await setTunnelConnection(message.tunnelId, ws.id);
  logger.info(`Tunnel connected: ${message.tunnelId}`);
}

async function handleDisconnect(ws: ExtendedWebSocket, message: WSMessage) {
  await removeTunnelConnection(message.tunnelId);
  ws.tunnelId = undefined;
  logger.info(`Tunnel disconnected: ${message.tunnelId}`);
}

async function handleRequest(ws: ExtendedWebSocket, message: WSMessage) {
  const targetTunnelId = await getTunnelConnection(message.tunnelId);
  if (!targetTunnelId) {
    logger.warn(`No connection found for tunnel: ${message.tunnelId}`);
    return;
  }

  // Forward the request to the appropriate client
  ws.send(JSON.stringify(message));
}
