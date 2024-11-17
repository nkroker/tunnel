import { TunnelClient } from './tunnel-client';
import { loadConfig } from './config';
import { logger } from './utils/logger';

async function main() {
  try {
    const config = loadConfig();
    const client = new TunnelClient(config);

    await client.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down client...');
      await client.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down client...');
      await client.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start client:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
