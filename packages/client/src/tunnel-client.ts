import WebSocket from 'ws';
import { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http';
import { WSMessage, WSMessageType } from '@tunnel/common';
import { logger } from './utils/logger';
import { MessageProcessor } from './utils/message-processor';
import * as http from 'http';

interface ProxyRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body?: any;
}

interface ProxyResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: any;
}

export class TunnelClient {
  private ws: WebSocket;
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
    this.ws = this.createWebSocketConnection();
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

    ws.on('message', async (data) => {
      try {
        const messageStr = data instanceof Buffer ? data.toString() : data.toString();
        logger.debug('Received raw message:', messageStr);

        if (!messageStr) {
          logger.warn('Received empty message');
          return;
        }

        const message = await this.messageProcessor.processIncomingMessage(messageStr);
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

  private async handleProxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
    return new Promise((resolve, reject) => {
      const proxyReq = http.request({
        hostname: 'localhost',
        port: this.config.localPort,
        path: request.url || '/',
        method: request.method,
        headers: request.headers
      }, (proxyRes) => {
        let body = '';
        proxyRes.on('data', chunk => {
          body += chunk;
        });

        proxyRes.on('end', () => {
          resolve({
            statusCode: proxyRes.statusCode || 500,
            headers: proxyRes.headers,
            body: body
          });
        });
      });

      proxyReq.on('error', (error) => {
        logger.error('Proxy request error:', error);
        reject(error);
      });

      if (request.body) {
        proxyReq.write(request.body);
      }
      proxyReq.end();
    });
  }

  private async handleMessage(message: WSMessage) {
    try {
      switch (message.type) {
        case WSMessageType.REQUEST:
          const request = message.payload as ProxyRequest;
          logger.info(`Proxying request: ${request.method} ${request.url}`);

          const response = await this.handleProxyRequest(request);

          const responseMessage: WSMessage = {
            type: WSMessageType.RESPONSE,
            tunnelId: this.config.tunnelId,
            payload: response,
            timestamp: Date.now()
          };

          const processed = await this.messageProcessor.processOutgoingMessage(responseMessage);
          this.ws.send(processed);
          break;

        case WSMessageType.HEARTBEAT:
          // Handle heartbeat
          break;

        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
    }
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
    logger.info('Tunnel client stopped');
  }
}
