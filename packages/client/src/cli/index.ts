import { Command } from 'commander';
import { TunnelClient } from '../tunnel-client';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const DEFAULT_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key';

const program = new Command();

program
  .name('tunnel-client')
  .description('CLI to manage tunnel connections')
  .version('0.1.0');

program
  .command('http <port>')
  .description('Start HTTP tunnel to local port')
  .option('-u, --url <url>', 'Tunnel server URL', 'ws://localhost:3000')
  .option('-k, --key <key>', 'Encryption key', DEFAULT_ENCRYPTION_KEY)
  .action(async (port, options) => {
    try {
      // Generate a unique tunnel ID
      const tunnelId = crypto.randomBytes(4).toString('hex');

      const config = {
        serverUrl: options.url,
        localPort: parseInt(port, 10),
        tunnelId: tunnelId,
        encryptionKey: options.key,
        maxReconnectAttempts: 5,
        heartbeatInterval: 30000
      };

      const client = new TunnelClient(config);
      await client.start();

      // Calculate and display the public URL using subdomain
      const serverHost = new URL(options.url.replace('ws://', 'http://')).host;
      const baseHost = serverHost.split(':')[0]; // Remove port if present
      const publicUrl = `http://${tunnelId}.${baseHost}:3000`;

      logger.info('Tunnel started successfully');
      logger.info(`Forwarding ${publicUrl} -> localhost:${port}`);
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
  });

program.parse();
