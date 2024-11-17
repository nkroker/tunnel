import { WebSocket, WebSocketServer } from 'ws';
import { WSMessage, WSMessageType } from '@tunnel/common';
import { logger } from '../utils/logger';
import { MessageProcessor } from '../utils/message-processor';
import { IncomingMessage } from 'http';

// Use a constant key that matches the client's default
const ENCRYPTION_KEY = 'your-32-character-encryption-key';

// Store both client and tunnel mappings
const clients = new Map<string, WebSocket>();
const tunnels = new Map<string, WebSocket>();

const messageProcessor = new MessageProcessor(
  process.env.ENCRYPTION_KEY || ENCRYPTION_KEY
);

logger.debug('WebSocket server using encryption key:', process.env.ENCRYPTION_KEY || ENCRYPTION_KEY);

export function setupWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', async (ws) => {
    const clientId = generateClientId();
    clients.set(clientId, ws);
    logger.info(`New client connected: ${clientId}`);

    ws.on('message', async (data) => {
      try {
        const message = await messageProcessor.processIncomingMessage(data.toString());

        // Store tunnel mapping when client sends CONNECT message
        if (message.type === WSMessageType.CONNECT) {
          tunnels.set(message.tunnelId, ws);
          logger.info(`Tunnel registered: ${message.tunnelId} (Client: ${clientId})`);
        }

        await handleMessage(ws, message, clientId);
      } catch (error) {
        logger.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      // Clean up both mappings
      clients.delete(clientId);
      for (const [tunnelId, socket] of tunnels.entries()) {
        if (socket === ws) {
          tunnels.delete(tunnelId);
          logger.info(`Tunnel unregistered: ${tunnelId}`);
        }
      }
      logger.info(`Client disconnected: ${clientId}`);
    });
  });
}

async function handleMessage(ws: WebSocket, message: WSMessage, clientId: string) {
  try {
    switch (message.type) {
      case WSMessageType.CONNECT:
        // Handle connection
        break;
      case WSMessageType.HEARTBEAT:
        const response = {
          type: WSMessageType.HEARTBEAT,
          tunnelId: message.tunnelId,
          payload: null,
          timestamp: Date.now(),
        };
        const processed = await messageProcessor.processOutgoingMessage(response);
        ws.send(processed);
        break;
      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    logger.error('Error handling message:', error);
  }
}

function generateClientId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export function setupHttpProxy(req: IncomingMessage, res: any, tunnelId: string) {
  const ws = findClientByTunnelId(tunnelId);
  if (!ws) {
    res.writeHead(404).end(`Tunnel ${tunnelId} not found`);
    return;
  }

  const proxyRequest = {
    method: req.method,
    url: req.url,
    headers: req.headers,
  };

  const message: WSMessage = {
    type: WSMessageType.REQUEST,
    tunnelId,
    payload: proxyRequest,
    timestamp: Date.now()
  };

  // Process the message before sending
  messageProcessor.processOutgoingMessage(message)
    .then(processed => {
      ws.send(processed);

      // Set up response handling
      ws.once('message', async (data) => {
        try {
          const responseStr = data instanceof Buffer ? data.toString() : data.toString();
          const processedResponse = await messageProcessor.processIncomingMessage(responseStr);
          const response = processedResponse.payload;

          res.writeHead(response.statusCode, response.headers);
          res.end(response.body);
        } catch (error) {
          logger.error('Error handling proxy response:', error);
          res.writeHead(500).end('Internal Server Error');
        }
      });
    })
    .catch(error => {
      logger.error('Error processing proxy request:', error);
      res.writeHead(500).end('Internal Server Error');
    });
}

function findClientByTunnelId(tunnelId: string): WebSocket | undefined {
  // Use the tunnel mapping instead of client mapping
  return tunnels.get(tunnelId);
}
