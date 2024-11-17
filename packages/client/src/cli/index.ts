import { Command } from 'commander';
import { TunnelClient } from '../tunnel-client';
import { loadConfig } from '../config';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Config, CliConfig } from '../config';

const program = new Command();

program
  .name('tunnel-client')
  .description('CLI to manage tunnel connections')
  .version('0.1.0');

program
  .command('start')
  .description('Start a new tunnel')
  .option('-c, --config <path>', 'Path to config file')
  .option('-p, --port <number>', 'Local port to tunnel', '3000')
  .option('-u, --url <url>', 'Tunnel server URL')
  .option('-t, --token <token>', 'Authentication token')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);

      // Override config with CLI options
      if (options.port) config.localPort = parseInt(options.port, 10);
      if (options.url) config.serverUrl = options.url;
      if (options.token) config.authToken = options.token;

      const client = new TunnelClient(config);
      await client.start();

      logger.info('Tunnel started successfully');
      logger.info(`Forwarding traffic to localhost:${config.localPort}`);

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

program
  .command('status')
  .description('Check tunnel status')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      logger.info('Tunnel status:', {
        serverUrl: config.serverUrl,
        localPort: config.localPort,
        tunnelId: config.tunnelId
      });
    } catch (error) {
      logger.error('Failed to check status:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new tunnel configuration')
  .option('-d, --dir <directory>', 'Directory to create config', process.cwd())
  .action(async (options) => {
    try {
      const configPath = path.join(options.dir, '.tunnel.config.json');
      const config: CliConfig = {
        serverUrl: 'ws://localhost:3000',
        localPort: 3000,
        tunnelId: crypto.randomBytes(16).toString('hex'),
        encryptionKey: crypto.randomBytes(32).toString('hex'),
        maxReconnectAttempts: 5,
        heartbeatInterval: 30000,
        compressionThreshold: 1024,
        requestTimeout: 30000,
        authToken: process.env.AUTH_TOKEN
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      logger.info(`Created config file at ${configPath}`);
    } catch (error) {
      logger.error('Failed to create config:', error);
      process.exit(1);
    }
  });

program
  .command('logs')
  .description('Show tunnel logs')
  .option('-n, --lines <number>', 'Number of lines to show', '100')
  .option('-f, --follow', 'Follow log output')
  .action(async (options) => {
    try {
      const logFile = path.join(process.cwd(), 'tunnel.log');
      const lines = parseInt(options.lines, 10);

      if (options.follow) {
        // Implement log following (tail -f like functionality)
        const tail = require('tail').Tail;
        new tail(logFile).on('line', (line: string) => console.log(line));
      } else {
        // Show last n lines
        const logs = await fs.readFile(logFile, 'utf-8');
        const lastLines = logs.split('\n').slice(-lines).join('\n');
        console.log(lastLines);
      }
    } catch (error) {
      logger.error('Failed to read logs:', error);
      process.exit(1);
    }
  });

program
  .command('metrics')
  .description('Show tunnel metrics')
  .option('-t, --time <period>', 'Time period (1h, 24h, 7d)', '1h')
  .action(async (options) => {
    try {
      // Implement metrics collection and display
      logger.info('Showing metrics for last', options.time);
      // Add actual metrics implementation
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      process.exit(1);
    }
  });

program.parse();
