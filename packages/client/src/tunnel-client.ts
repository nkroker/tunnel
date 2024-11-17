import WebSocket from 'ws';
import httpProxy from 'http-proxy';
import { WSMessage, WSMessageType } from '@tunnel/common';
import { logger } from './utils/logger';
import { MessageProcessor } from './utils/message-processor';

export class TunnelClient {
  private ws: WebSocket;
  private proxy: httpProxy;
  private messageProcessor: MessageProcessor;
  private reconnectAttempts = 0;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    private config: {
      serverUrl: string;
      localPort: number;
      tunnelId: string;
      encryptionKey: string;
      maxReconnectAttempts: number;
      heartbeatInterval: number;
    }
  ) {
    this.messageProcessor = new MessageProcessor(config.encryptionKey);
    this.proxy = httpProxy.createProxyServer({});
    this.ws = this.createWebSocketConnection();
    this.setupProxyErrorHandling();
  }

  private createWebSocketConnection(): WebSocket {
    const ws = new WebSocket(this.config.serverUrl);

    ws.on('open', () => {
      logger.info('Connected to tunnel server');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.sendMessage({
        type: WSMessageType.CONNECT,
        tunnelId: this.config.tunnelId,
        payload: { localPort: this.config.localPort },
        timestamp: Date.now(),
      });
    });

    ws.on('message', async (data: string) => {
      try {
        const message = await this.messageProcessor.processIncomingMessage(data);
        await this.handleMessage(message);
      } catch (error) {
        logger.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      logger.warn('Connection closed');
      this.stopHeartbeat();
      this.handleReconnection();
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    return ws;
  }

  private setupProxyErrorHandling() {
    this.proxy.on('error', (err: Error) => {
      logger.error('Proxy error:', err);
    });
  }

  private async handleMessage(message: WSMessage) {
    switch (message.type) {
      case WSMessageType.REQUEST:
        await this.handleRequest(message);
        break;
      case WSMessageType.HEARTBEAT:
        await this.sendMessage({
          type: WSMessageType.HEARTBEAT,
          tunnelId: this.config.tunnelId,
          payload: null,
          timestamp: Date.now(),
        });
        break;
      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  private async handleRequest(message: WSMessage) {
    // Implement request handling
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendMessage({
        type: WSMessageType.HEARTBEAT,
        tunnelId: this.config.tunnelId,
        payload: null,
        timestamp: Date.now(),
      });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  private handleReconnection() {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      logger.info(`Attempting to reconnect in ${delay}ms...`);
      setTimeout(() => {
        this.ws = this.createWebSocketConnection();
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached');
    }
  }

  private async sendMessage(message: WSMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const processed = await this.messageProcessor.processOutgoingMessage(message);
      this.ws.send(processed);
    }
  }

  public async start() {
    logger.info('Starting tunnel client');
    return this;
  }

  public async stop() {
    this.stopHeartbeat();
    this.ws.close();
    this.proxy.close();
    logger.info('Tunnel client stopped');
  }
}
