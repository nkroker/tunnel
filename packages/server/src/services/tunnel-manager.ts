import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { WSMessage, WSMessageType } from '@tunnel/common';

export class TunnelManager extends EventEmitter {
  private static instance: TunnelManager;
  private tunnels: Map<string, WebSocket>;
  private responsePromises: Map<string, { resolve: Function; reject: Function }>;
  private responseTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly RESPONSE_TIMEOUT = 30000; // 30 seconds timeout

  private constructor() {
    super(); // Initialize EventEmitter
    this.tunnels = new Map();
    this.responsePromises = new Map();
  }

  public static getInstance(): TunnelManager {
    if (!TunnelManager.instance) {
      TunnelManager.instance = new TunnelManager();
    }
    return TunnelManager.instance;
  }

  public addTunnel(tunnelId: string, ws: WebSocket): void {
    this.tunnels.set(tunnelId, ws);
    logger.info(`Tunnel registered: ${tunnelId}`);
  }

  public removeTunnel(tunnelId: string): void {
    this.tunnels.delete(tunnelId);
    logger.info(`Tunnel removed: ${tunnelId}`);
  }

  public getTunnel(tunnelId: string): WebSocket | undefined {
    return this.tunnels.get(tunnelId);
  }

  // Alias for getTunnel to fix the getClient error
  private getClient(tunnelId: string): WebSocket | undefined {
    return this.getTunnel(tunnelId);
  }

  public async waitForResponse(tunnelId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responsePromises.delete(tunnelId);
        reject(new Error('Response timeout'));
      }, 30000); // 30 second timeout

      this.responsePromises.set(tunnelId, {
        resolve: (response: any) => {
          clearTimeout(timeout);
          this.responsePromises.delete(tunnelId);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          this.responsePromises.delete(tunnelId);
          reject(error);
        }
      });
    });
  }

  public resolveResponse(tunnelId: string, response: any): void {
    const promise = this.responsePromises.get(tunnelId);
    if (promise) {
      promise.resolve(response);
    }
  }

  public rejectResponse(tunnelId: string, error: Error): void {
    const promise = this.responsePromises.get(tunnelId);
    if (promise) {
      promise.reject(error);
    }
  }

  async handleTunnelRequest(tunnelId: string, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Generate unique request ID
        const requestId = `${tunnelId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Set timeout for response
        const timeout = setTimeout(() => {
          this.removeListener(`response:${requestId}`, responseHandler);
          this.responseTimeouts.delete(requestId);
          reject(new Error(`Response timeout for tunnel ${tunnelId}`));
        }, this.RESPONSE_TIMEOUT);

        // Define response handler
        const responseHandler = (response: any) => {
          clearTimeout(timeout);
          this.responseTimeouts.delete(requestId);
          resolve(response);
        };

        this.responseTimeouts.set(requestId, timeout);

        // Register response handler
        this.once(`response:${requestId}`, responseHandler);

        // Send request to client
        this.sendRequestToClient(tunnelId, {
          ...request,
          requestId
        }).catch(error => {
          clearTimeout(timeout);
          this.removeListener(`response:${requestId}`, responseHandler);
          this.responseTimeouts.delete(requestId);
          reject(error);
        });

      } catch (error) {
        logger.error('Error in handleTunnelRequest:', error);
        reject(error);
      }
    });
  }

  private async sendRequestToClient(tunnelId: string, request: any): Promise<void> {
    const client = this.getClient(tunnelId);
    if (!client) {
      throw new Error(`No client found for tunnel ${tunnelId}`);
    }

    try {
      const message: WSMessage = {
        type: WSMessageType.REQUEST,
        tunnelId,
        payload: request,
        timestamp: Date.now()
      };

      await new Promise<void>((resolve, reject) => {
        client.send(JSON.stringify(message), (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      logger.debug(`Request sent to tunnel ${tunnelId}`);
    } catch (error) {
      logger.error(`Failed to send request to tunnel ${tunnelId}:`, error);
      throw error;
    }
  }

  // Clean up timeouts when client disconnects
  handleClientDisconnect(tunnelId: string): void {
    this.responseTimeouts.forEach((timeout, requestId) => {
      if (requestId.startsWith(tunnelId)) {
        clearTimeout(timeout);
        this.responseTimeouts.delete(requestId);
      }
    });
  }
}
