import { TunnelClient } from './tunnel-client';
import { logger } from './utils/logger';
import crypto from 'crypto';

async function main() {
  try {
    // Generate a unique tunnel ID if not provided
    const tunnelId = process.env.TUNNEL_ID || crypto.randomBytes(8).toString('hex');

    const config = {
      serverUrl: process.env.TUNNEL_SERVER_URL || 'ws://localhost:3000',
      localPort: parseInt(process.env.LOCAL_PORT || '8080', 10),
      tunnelId: tunnelId,
      encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key',
      maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '5', 10),
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10)
    };

    const client = new TunnelClient(config);
    await client.start();

    // Calculate and display the public URL
    const serverHost = new URL(config.serverUrl.replace('ws://', 'http://')).host;
    const publicUrl = `http://${serverHost}/tunnel/${tunnelId}`;

    logger.info('Tunnel started successfully');
    logger.info(`Forwarding ${publicUrl} -> localhost:${config.localPort}`);
    logger.info('Press Ctrl+C to stop');

    process.on('SIGINT', async () => {
      logger.info('Shutting down tunnel...');
      await client.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start tunnel:', error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
