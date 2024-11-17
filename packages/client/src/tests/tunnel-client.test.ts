import { WebSocket } from 'ws';
import { TunnelClient } from '../tunnel-client';
import { WSMessageType } from '@tunnel/common';

// Mock WebSocket
jest.mock('ws');
const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('TunnelClient', () => {
  let client: TunnelClient;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup WebSocket mock
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      // Add other required WebSocket properties/methods
    } as unknown as jest.Mocked<WebSocket>;

    MockedWebSocket.mockImplementation(() => mockWs);

    client = new TunnelClient({
      serverUrl: 'ws://localhost:3000',
      tunnelId: 'test-tunnel',
      localPort: 8080,
      encryptionKey: 'test-key',
      maxReconnectAttempts: 3,
      heartbeatInterval: 30000
    });
  });

  // Update your test cases to use mockWs instead of ws.mock
  test('connects to WebSocket server', () => {
    expect(MockedWebSocket).toHaveBeenCalledWith('ws://localhost:3000');
    expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
  });

  // Update other test cases similarly
  test('sends connect message on open', () => {
    const onOpen = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
    onOpen?.bind(mockWs)();

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining(WSMessageType.CONNECT)
    );
  });

  // Continue updating other test cases...
});
