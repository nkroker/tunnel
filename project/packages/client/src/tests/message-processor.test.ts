import { MessageProcessor } from '../utils/message-processor';
import { WSMessageType } from '@tunnel/common';

describe('MessageProcessor', () => {
  const processor = new MessageProcessor('test-encryption-key-32-chars-long-key');
  const testMessage = {
    type: WSMessageType.CONNECT,
    tunnelId: 'test-id',
    payload: { test: 'data' },
    timestamp: Date.now()
  };

  test('should process outgoing message and return encrypted string', async () => {
    const processed = await processor.processOutgoingMessage(testMessage);
    expect(typeof processed).toBe('string');
  });

  test('should process incoming message and return original data', async () => {
    const processed = await processor.processOutgoingMessage(testMessage);
    const decoded = await processor.processIncomingMessage(processed);

    expect(decoded).toEqual(testMessage);
  });
});
