import WebSocket from 'ws';
import { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http';
import { WSMessage, WSMessageType, ProxyRequest, ProxyResponse, ProxyRequestWithRetry } from '@tunnel/common';
import { logger } from './utils/logger';
import { MessageProcessor } from './utils/message-processor';
import * as http from 'http';
import debug from 'debug';
import { EventEmitter } from 'events';
const log = debug('tunnel:client');
const perfLog = debug('tunnel:performance');
const requestLog = debug('tunnel:request');
const startupLog = debug('tunnel:startup');
const connectionLog = debug('tunnel:connection');

export class TunnelClient extends EventEmitter {
  private ws: WebSocket;
  private messageProcessor: MessageProcessor;
  private reconnectAttempts = 0;
  private heartbeatInterval?: NodeJS.Timeout;
  private hostname: string;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private config: {
      serverUrl: string;
      localPort: number;
      tunnelId: string;
      encryptionKey: string;
      maxReconnectAttempts: number;
      heartbeatInterval: number;
      hostname?: string;
      requestTimeout?: number;
      healthCheckPath?: string;
      healthCheckMethod?: string;
      useEncryption?: boolean;
    }
  ) {
    super();
    if (config.useEncryption !== false && (!config.encryptionKey || config.encryptionKey.length < 32)) {
      logger.warn('Encryption key should be at least 32 characters long');
    }

    this.config.requestTimeout = this.config.requestTimeout || 30000;
    this.config.healthCheckPath = this.config.healthCheckPath || '/';
    this.config.healthCheckMethod = this.config.healthCheckMethod || 'HEAD';

    this.messageProcessor = new MessageProcessor(
      config.encryptionKey,
      config.useEncryption !== false
    );
    this.ws = this.createWebSocketConnection();
    this.hostname = config.hostname || 'localtest.me';
    logger.info(`Tunnel hostname configured as: ${this.config.tunnelId}.${this.hostname}`);
    logger.info(`Encryption: ${config.useEncryption !== false ? 'enabled' : 'disabled'}`);
  }

  private createWebSocketConnection(): WebSocket {
    connectionLog('Creating WebSocket connection...');
    connectionLog(`Server URL: ${this.config.serverUrl}`);
    connectionLog(`Tunnel ID: ${this.config.tunnelId}`);

    const ws = new WebSocket(this.config.serverUrl, {
        headers: {
            'tunnel-id': this.config.tunnelId
        }
    });

    ws.on('open', () => {
        const tunnelUrl = `http://${this.config.tunnelId}.${this.hostname}:3000`;
        connectionLog('🟢 WebSocket connection established');

        // Send initial connection message immediately
        const connectMessage: WSMessage = {
            type: WSMessageType.CONNECT,
            tunnelId: this.config.tunnelId,
            payload: {
                localPort: this.config.localPort,
                tunnelId: this.config.tunnelId
            },
            timestamp: Date.now()
        };

        // Log the connection message
        connectionLog('📤 Sending connection message:', connectMessage);

        this.sendMessage(connectMessage).then(() => {
            connectionLog('✅ Connection message sent successfully');
        }).catch(error => {
            connectionLog('❌ Failed to send connection message:', error);
        });

        startupLog('🚀 Tunnel Client Started Successfully');
        startupLog('=================================');
        startupLog(`Tunnel URL: ${tunnelUrl}`);
        startupLog(`Local Port: ${this.config.localPort}`);
        startupLog('=================================');

        logger.info('Connected to tunnel server');
        logger.info(`🚀 Tunnel is accessible at: ${tunnelUrl}`);

        console.log('\n=================================');
        console.log(`🚀 Tunnel URL: ${tunnelUrl}`);
        console.log(`📡 Forwarding to: http://localhost:${this.config.localPort}`);
        console.log('=================================\n');

        this.reconnectAttempts = 0;
        this.startHeartbeat();

        this.emit('connected');
    });

    ws.on('message', async (data) => {
        connectionLog('📥 Received WebSocket message');
        try {
            const messageStr = data instanceof Buffer ? data.toString() : data.toString();
            connectionLog('Message details:', {
                length: messageStr.length,
                preview: messageStr.substring(0, 100)
            });

            if (!messageStr) {
                logger.warn('Received empty message');
                return;
            }

            const message = await this.messageProcessor.processIncomingMessage(messageStr);
            await this.handleMessage(message);
        } catch (error) {
            connectionLog('❌ Error processing message:', error);
            if (error instanceof Error) {
                connectionLog('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
        }
    });

    ws.on('close', (code, reason) => {
        connectionLog('🔴 WebSocket connection closed', {
            code,
            reason: reason.toString()
        });
        this.stopHeartbeat();
        this.handleReconnection();
    });

    ws.on('error', (error) => {
        connectionLog('❌ WebSocket error:', {
            error: error.message,
            stack: error.stack
        });
    });

    return ws;
  }

  private async handleProxyRequest(request: Required<ProxyRequest>): Promise<ProxyResponse> {
    return new Promise((resolve) => {
      const url = request.url || '/';
      let isResolved = false;

      requestLog(`🔄 Proxying ${request.method} ${url} to local server`);

      // Handle favicon.ico requests specially
      if (url === '/favicon.ico') {
        return resolve({
          statusCode: 404,
          headers: {},
          body: '',
          requestId: request.requestId
        });
      }

      logger.info('🔄 Proxying request to local server:', {
        url,
        port: this.config.localPort,
        method: request.method,
        requestId: request.requestId
      });

      const proxyReq = http.request({
        hostname: '127.0.0.1',
        port: this.config.localPort,
        path: url,
        method: request.method,
        headers: {
          ...this.normalizeHeaders(request.headers),
          'Host': `127.0.0.1:${this.config.localPort}`,
          'Connection': 'keep-alive',
          'Accept-Encoding': 'identity'
        },
        timeout: this.config.requestTimeout,
        agent: false
      }, (proxyRes) => {
        requestLog(`📥 Received response from local server for ${request.requestId}:`, {
          statusCode: proxyRes.statusCode,
          headers: proxyRes.headers
        });

        let body = '';
        const contentType = proxyRes.headers['content-type'] || '';
        const isTextContent = contentType.includes('text') ||
                             contentType.includes('json') ||
                             contentType.includes('javascript') ||
                             contentType.includes('xml');

        proxyRes.on('data', chunk => {
          if (isTextContent) {
            body += chunk;
          } else {
            body += chunk.toString('base64');
          }
          logger.debug('📦 Received chunk of data', {
            chunkLength: chunk.length,
            requestId: request.requestId
          });
        });

        proxyRes.on('end', () => {
          if (!isResolved) {
            isResolved = true;
            logger.info('✅ Response completed', {
              url: url,
              method: request.method,
              statusCode: proxyRes.statusCode,
              bodyLength: body.length,
              requestId: request.requestId
            });

            const headers = { ...proxyRes.headers };
            if (!isTextContent) {
              headers['content-transfer-encoding'] = 'base64';
            }

            resolve({
              statusCode: proxyRes.statusCode || 500,
              headers: headers,
              body: body,
              requestId: request.requestId
            });
          }
        });
      });

      proxyReq.on('socket', (socket) => {
        logger.debug('🔌 Socket created for request', {
          requestId: request.requestId,
          url: url
        });

        socket.setTimeout(30000);

        socket.on('connect', () => {
          logger.info('🔌 Socket connected', {
            requestId: request.requestId,
            url: url
          });
        });

        socket.on('timeout', () => {
          logger.error('⚠️ Socket timeout', {
            requestId: request.requestId,
            url: url
          });
          proxyReq.destroy();
        });

        socket.on('error', (error) => {
          logger.error('⚠️ Socket error:', {
            error: error.message,
            code: (error as NodeJS.ErrnoException).code,
            requestId: request.requestId,
            url: url
          });
        });
      });

      proxyReq.on('error', (error: NodeJS.ErrnoException) => {
        requestLog(`❌ Proxy request error for ${request.requestId}:`, {
          error: error.message,
          code: error.code
        });

        if (!isResolved) {
          isResolved = true;
          this.handleError(error, request, resolve);
        }
      });

      proxyReq.on('finish', () => {
        logger.debug('📤 Request finished writing', {
          requestId: request.requestId,
          url: url
        });
      });

      if (request.body) {
        proxyReq.write(request.body);
        logger.debug('📝 Wrote request body', {
          bodyLength: request.body.length,
          requestId: request.requestId
        });
      }

      proxyReq.end();
      logger.debug('📤 Request ended', {
        url,
        method: request.method,
        requestId: request.requestId
      });
    });
  }

  private async handleMessage(message: WSMessage) {
    try {
      switch (message.type) {
        case WSMessageType.REQUEST:
          const request = message.payload as Required<ProxyRequest>;
          const requestStartTime = Date.now();

          requestLog(`➡️ Incoming request: ${request.method} ${request.url}`);
          requestLog({
            requestId: request.requestId,
            method: request.method,
            url: request.url,
            headers: request.headers,
            timestamp: new Date().toISOString()
          });

          try {
            // First verify local server is accessible
            const isServerAccessible = await this.checkLocalServer();
            if (!isServerAccessible) {
              requestLog(`❌ Local server not accessible for request ${request.requestId}`);
              throw new Error('Local server not accessible');
            }

            requestLog(`✅ Forwarding request ${request.requestId} to local server`);
            const response = await this.handleProxyRequest(request);
            const processingTime = Date.now() - requestStartTime;

            requestLog(`✅ Request completed in ${processingTime}ms`, {
              requestId: request.requestId,
              statusCode: response.statusCode,
              processingTime
            });

            const responseMessage: WSMessage = {
              type: WSMessageType.RESPONSE,
              tunnelId: this.config.tunnelId,
              payload: {
                ...response,
                requestId: request.requestId
              },
              timestamp: Date.now()
            };

            const processed = await this.messageProcessor.processOutgoingMessage(responseMessage);
            this.ws.send(processed);
            requestLog(`📤 Response sent for request ${request.requestId}`);

          } catch (error) {
            requestLog(`❌ Error processing request ${request.requestId}:`, error);

            const errorMessage: WSMessage = {
              type: WSMessageType.ERROR,
              tunnelId: this.config.tunnelId,
              payload: {
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId: request.requestId,
                statusCode: 502
              },
              timestamp: Date.now()
            };

            const processed = await this.messageProcessor.processOutgoingMessage(errorMessage);
            this.ws.send(processed);
          }
          break;

        case WSMessageType.HEARTBEAT:
          log('💓 Received heartbeat');
          break;

        default:
          log(`⚠️ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      log('❌ Error in handleMessage:', error);
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
    connectionLog('🚀 Starting tunnel client');

    // Check if server is accessible
    try {
        const serverUrl = new URL(this.config.serverUrl);
        // Use WebSocket URL for health check
        const wsProtocol = serverUrl.protocol === 'ws:' ? 'http:' : 'https:';
        const testUrl = `${wsProtocol}//${serverUrl.host}/health`;
        connectionLog(`Checking server health at ${testUrl}`);

        try {
            const response = await fetch(testUrl);
            if (!response.ok) {
                connectionLog(`Server health check failed: ${response.status} ${response.statusText}`);
                throw new Error(`Server returned ${response.status}`);
            }
            connectionLog('✅ Tunnel server is accessible');
        } catch (error) {
            connectionLog('❌ Server health check failed:', error);
            // Don't throw here - continue with WebSocket connection attempt
            connectionLog('Attempting WebSocket connection anyway...');
        }

        // Check local server first
        const isLocalServerRunning = await this.checkLocalServer();
        if (!isLocalServerRunning) {
            throw new Error('Local server is not running');
        }
        connectionLog('✅ Local server is running');

        // Initialize WebSocket connection
        this.ws = this.createWebSocketConnection();

        return this;
    } catch (error) {
        connectionLog('❌ Failed to start tunnel:', error);
        throw error;
    }
  }

  public async stop() {
    this.stopHeartbeat();
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.ws.close();
    logger.info('Tunnel client stopped');
  }

  private normalizeAssetUrl(url: string): string {
    // Strip /tunnel/{tunnelId} prefix
    const pathRegex = new RegExp(`^/tunnel/${this.config.tunnelId}`);
    let normalizedUrl = url.replace(pathRegex, '');

    // Ensure the URL starts with a forward slash
    if (!normalizedUrl.startsWith('/')) {
      normalizedUrl = '/' + normalizedUrl;
    }

    logger.debug('Normalized asset URL:', {
      original: url,
      normalized: normalizedUrl
    });

    return normalizedUrl;
  }

  private normalizeHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
    const normalized: IncomingHttpHeaders = {};

    Object.entries(headers).forEach(([key, value]) => {
      if (!['host', 'connection', 'referer', 'origin'].includes(key.toLowerCase())) {
        normalized[key] = value;
      }
    });

    normalized.host = `localhost:${this.config.localPort}`;
    normalized.connection = 'keep-alive';

    if (headers.referer) {
      try {
        const refererUrl = new URL(headers.referer);
        normalized.referer = `http://localhost:${this.config.localPort}${refererUrl.pathname}${refererUrl.search}`;
      } catch (e) {
        logger.debug('Failed to parse referer URL, skipping', { referer: headers.referer });
      }
    }

    return normalized;
  }

  private async checkLocalServer(): Promise<boolean> {
    return new Promise((resolve) => {
      logger.info('🔍 Checking local server...', {
        host: '127.0.0.1',
        port: this.config.localPort,
        path: this.config.healthCheckPath,
        method: this.config.healthCheckMethod
      });

      const testReq = http.request({
        hostname: '127.0.0.1',
        port: this.config.localPort,
        path: this.config.healthCheckPath || '/',
        method: this.config.healthCheckMethod || 'GET',
        timeout: 5000,
        headers: {
          'User-Agent': 'TunnelHealthCheck/1.0',
          'Accept': '*/*',
          'Host': `127.0.0.1:${this.config.localPort}`,
          'Connection': 'close'
        }
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          logger.info('✅ Local server is running', {
            statusCode: res.statusCode,
            port: this.config.localPort,
            responseSize: data.length
          });
          resolve(true);
        });
      });

      testReq.on('error', (error: NodeJS.ErrnoException) => {
        logger.error('❌ Local server check failed:', {
          error: error.message,
          code: error.code,
          port: this.config.localPort,
          details: error.stack
        });

        if (error.code === 'ECONNREFUSED') {
          logger.error('👉 Make sure your Rails server is running:', {
            command: `rails s -p ${this.config.localPort}`
          });
        }
        resolve(false);
      });

      testReq.on('timeout', () => {
        logger.error('⏰ Local server check timed out', {
          port: this.config.localPort,
          timeout: '5000ms'
        });
        testReq.destroy();
        resolve(false);
      });

      testReq.on('socket', (socket) => {
        logger.debug('🔌 Socket created for health check');

        socket.on('connect', () => {
          logger.debug('🔌 Connected to local server for health check');
        });
      });

      testReq.end();
      logger.debug('🚀 Health check request sent');
    });
  }

  private handleError(error: NodeJS.ErrnoException, request: Required<ProxyRequest>, resolve: (response: ProxyResponse) => void) {
    logger.error('Proxy request error:', {
      error: error.message,
      code: error.code,
      url: request.url,
      method: request.method,
      port: this.config.localPort,
      stack: error.stack
    });

    // Check if Rails server is running
    this.checkLocalServer().then(isRunning => {
      let errorMessage = 'Failed to connect to local server. ';
      if (!isRunning) {
        errorMessage = `Rails server is not running on port ${this.config.localPort}. Please start your Rails server with: rails s -p ${this.config.localPort}`;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = `Rails server refused the connection on port ${this.config.localPort}. Make sure it's accepting connections.`;
      } else if (error.code === 'ECONNRESET') {
        errorMessage = 'The Rails server reset the connection. This might be due to a timeout or the server being overloaded.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = `Rails server took too long to respond (timeout: 30s). You might need to check for slow queries or increase the timeout.`;
      } else {
        errorMessage = error.message;
      }

      resolve({
        statusCode: 502,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        },
        body: `
          <html>
            <head>
              <title>Rails Server Error</title>
              <style>
                body { font-family: -apple-system, system-ui, sans-serif; padding: 2rem; line-height: 1.5; }
                .error { color: #e53e3e; margin-bottom: 1rem; }
                .details { color: #718096; background: #f7fafc; padding: 1rem; border-radius: 4px; }
                .help { margin-top: 1rem; color: #2b6cb0; }
              </style>
            </head>
            <body>
              <h1 class="error">Rails Server Error</h1>
              <p>${errorMessage}</p>
              <div class="details">
                <p>Technical Details:</p>
                <ul>
                  <li>Error Code: ${error.code || 'Unknown'}</li>
                  <li>Port: ${this.config.localPort}</li>
                  <li>URL: ${request.url}</li>
                  <li>Method: ${request.method}</li>
                </ul>
              </div>
              <div class="help">
                <p>Troubleshooting Steps:</p>
                <ol>
                  <li>Make sure your Rails server is running: <code>rails s -p ${this.config.localPort}</code></li>
                  <li>Check Rails logs for any errors</li>
                  <li>Ensure your database is running and accessible</li>
                  <li>Check for any long-running queries or processes</li>
                </ol>
              </div>
            </body>
          </html>
        `,
        requestId: request.requestId
      });
    });
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      const isRunning = await this.checkLocalServer();
      if (!isRunning) {
        logger.warn('⚠️ Local server health check failed');
      } else {
        logger.debug('✅ Local server health check passed');
      }
    }, 30000); // Check every 30 seconds
  }

  // Add this method to verify local server
  private async verifyLocalServer(): Promise<boolean> {
    try {
      logger.info('🔍 Verifying local server connection...');
      const isRunning = await this.checkLocalServer();
      if (isRunning) {
        logger.info('✅ Local server is running and accessible');
      } else {
        logger.error('❌ Local server is not responding');
      }
      return isRunning;
    } catch (error) {
      logger.error('❌ Error verifying local server:', error);
      return false;
    }
  }

  // Add a method to check server status
  private async checkServerStatus(): Promise<boolean> {
    try {
        const serverUrl = new URL(this.config.serverUrl);
        const wsProtocol = serverUrl.protocol === 'ws:' ? 'http:' : 'https:';
        const testUrl = `${wsProtocol}//${serverUrl.host}/health`;

        const response = await fetch(testUrl);
        return response.ok;
    } catch (error) {
        connectionLog('Server status check failed:', error);
        return false;
    }
  }
}
