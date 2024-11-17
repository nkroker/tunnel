import { TunnelClient } from '../tunnel-client';
import WebSocket from 'ws';
import { WSMessageType, RequestData } from '@tunnel/common';

jest.mock('ws');
jest.mock('../utils/logger');
jest.mock('http-proxy');

describe('TunnelClient', () => {
  let client: TunnelClient;
  const mockConfig = {
    serverUrl: 'ws://localhost:3000',
    localPort: 8080,
    tunnelId: 'test-tunnel-id',
    encryptionKey: 'test-encryption-key-32-chars-long-key',
    maxReconnectAttempts: 5,
    heartbeatInterval: 1000,
    compressionThreshold: 1024,
    requestTimeout: 5000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new TunnelClient(mockConfig);
  });

  describe('Connection Management', () => {
    test('should create WebSocket connection on initialization', () => {
      expect(WebSocket).toHaveBeenCalledWith(
        mockConfig.serverUrl,
        expect.any(Object)
      );
    });

    test('should handle connection open event', () => {
      const mockWs = WebSocket.mock.instances[0];
      const mockSend = jest.fn();
      mockWs.send = mockSend;

      mockWs.onopen();

      expect(mockSend).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      expect(sentMessage.type).toBe(WSMessageType.CONNECT);
      expect(sentMessage.tunnelId).toBe(mockConfig.tunnelId);
    });

    test('should handle reconnection on connection close', () => {
      const mockWs = WebSocket.mock.instances[0];
      mockWs.onclose();
      expect(WebSocket).toHaveBeenCalledTimes(2);
    });

    test('should stop reconnection attempts after max retries', () => {
      const mockWs = WebSocket.mock.instances[0];

      // Simulate multiple connection failures
      for (let i = 0; i <= mockConfig.maxReconnectAttempts + 1; i++) {
        mockWs.onclose();
      }

      expect(WebSocket).toHaveBeenCalledTimes(mockConfig.maxReconnectAttempts + 1);
    });
  });

  describe('Message Handling', () => {
    test('should handle incoming request messages', () => {
      const mockWs = WebSocket.mock.instances[0];
      const mockRequest: RequestData = {
        method: 'GET',
        path: '/test',
        headers: {},
        body: null,
        query: {}
      };

      const message = {
        type: WSMessageType.REQUEST,
        tunnelId: mockConfig.tunnelId,
        payload: mockRequest,
        timestamp: Date.now()
      };

      mockWs.onmessage({ data: JSON.stringify(message) });
      // Add assertions for request handling
    });

    test('should handle heartbeat messages', () => {
      const mockWs = WebSocket.mock.instances[0];
      const mockSend = jest.fn();
      mockWs.send = mockSend;

      const message = {
        type: WSMessageType.HEARTBEAT,
        tunnelId: mockConfig.tunnelId,
        payload: null,
        timestamp: Date.now()
      };

      mockWs.onmessage({ data: JSON.stringify(message) });
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle WebSocket errors', () => {
      const mockWs = WebSocket.mock.instances[0];
      const error = new Error('Connection failed');

      mockWs.onerror(error);
      // Add assertions for error handling
    });

    test('should handle invalid messages', () => {
      const mockWs = WebSocket.mock.instances[0];

      mockWs.onmessage({ data: 'invalid-json' });
      // Add assertions for invalid message handling
    });
  });

  describe('Cleanup', () => {
    test('should clean up resources on stop', async () => {
      const mockWs = WebSocket.mock.instances[0];
      await client.stop();

      expect(mockWs.close).toHaveBeenCalled();
      // Add assertions for other cleanup
    });
  });
});
