import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { WSMessage, WSMessageType } from '@tunnel/common';
import { logger } from '../utils/logger';
import { MessageProcessor } from '../utils/message-processor';
import { TunnelManager } from '../services/tunnel-manager';

export class WebSocketServer {
  private wss: WebSocket.Server;
  private messageProcessor: MessageProcessor;
  private tunnelManager: TunnelManager;

  constructor(server: any, encryptionKey: string) {
    this.wss = new WebSocket.Server({ server });
    this.messageProcessor = new MessageProcessor(encryptionKey);
    this.tunnelManager = TunnelManager.getInstance();

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    const clientId = Math.random().toString(36).substring(7);
    logger.info(`New client connected: ${clientId}`);

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const messageStr = data.toString();
        const message = await this.messageProcessor.processIncomingMessage(messageStr);
        await this.handleMessage(ws, message);
      } catch (error) {
        logger.error('Failed to process incoming message:', error);
      }
    });

    ws.on('close', () => {
      logger.info(`Client disconnected: ${clientId}`);
      this.tunnelManager.removeTunnel(clientId);
    });
  }

  private async handleMessage(ws: WebSocket, message: WSMessage) {
    switch (message.type) {
      case WSMessageType.CONNECT:
        this.tunnelManager.addTunnel(message.tunnelId, ws);
        break;

      case WSMessageType.RESPONSE:
        // Handle response from client
        break;

      case WSMessageType.HEARTBEAT:
        // Handle heartbeat
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }
}
