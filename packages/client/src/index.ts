import { TunnelClient } from './tunnel-client';
import { logger } from './utils/logger';
import crypto from 'crypto';
import debug from 'debug';

// Enable all debug logs programmatically
debug.enable('*');

async function main() {
  try {
    // Force console output for important startup information
    process.stdout.write('\n=========================================\n');
    process.stdout.write('🚀 Starting Tunnel Client\n');
    process.stdout.write('=========================================\n');

    const tunnelId = process.env.TUNNEL_ID || crypto.randomBytes(8).toString('hex');

    const config = {
      serverUrl: process.env.TUNNEL_SERVER_URL || 'ws://localhost:3000',
      localPort: parseInt(process.env.LOCAL_PORT || '8080', 10),
      tunnelId: tunnelId,
      encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key',
      maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '5', 10),
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
      useEncryption: false
    };

    // Force console output for configuration
    process.stdout.write(`Server URL: ${config.serverUrl}\n`);
    process.stdout.write(`Local Port: ${config.localPort}\n`);
    process.stdout.write(`Tunnel ID: ${config.tunnelId}\n`);
    process.stdout.write('=========================================\n\n');

    const client = new TunnelClient(config);

    // Add a timeout to detect connection issues
    const connectionTimeout = setTimeout(() => {
        process.stdout.write('\n❌ Failed to establish connection within 5 seconds\n');
        process.stdout.write('Please check:\n');
        process.stdout.write('1. Is the tunnel server running?\n');
        process.stdout.write(`2. Can you access ${config.serverUrl.replace('ws://', 'http://')}?\n`);
        process.stdout.write('3. Are there any firewall restrictions?\n');
        process.exit(1);
    }, 5000);

    // Clear timeout on successful connection
    client.once('connected', () => {
        clearTimeout(connectionTimeout);
    });

    await client.start();

    const serverHost = new URL(config.serverUrl.replace('ws://', 'http://')).host;
    const baseHost = serverHost.split(':')[0];
    const publicUrl = `http://${tunnelId}.${baseHost}:3000`;

    // Force console output for tunnel URL
    process.stdout.write('\n=========================================\n');
    process.stdout.write('🎉 Tunnel Client Started Successfully!\n');
    process.stdout.write('=========================================\n');
    process.stdout.write(`🌍 Public URL: ${publicUrl}\n`);
    process.stdout.write(`🔄 Forwarding to: http://localhost:${config.localPort}\n`);
    process.stdout.write('=========================================\n');
    process.stdout.write('Press Ctrl+C to stop\n\n');

    // Also log using logger for good measure
    logger.info(`Tunnel URL: ${publicUrl}`);
    logger.info(`Forwarding to: http://localhost:${config.localPort}`);

    process.on('SIGINT', async () => {
      process.stdout.write('\nShutting down tunnel...\n');
      await client.stop();
      process.exit(0);
    });

  } catch (error) {
    process.stdout.write('\n❌ Failed to start tunnel:\n');
    console.error(error);
    process.exit(1);
  }
}

main().catch(error => {
  process.stdout.write('\n❌ Unhandled error:\n');
  console.error(error);
  process.exit(1);
});
