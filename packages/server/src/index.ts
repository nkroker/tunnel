import express from 'express';
import { createServer } from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import { config } from 'dotenv';
import { setupWebSocketServer } from './websocket';
import { setupRoutes } from './routes';
import { setupRedis } from './services/redis';
import { logger } from './utils/logger';

config();

async function startServer() {
  try {
    // Initialize Redis
    await setupRedis();

    const app = express();
    const port = process.env.PORT || 3000;

    // Middleware
    app.use(cors());
    app.use(express.json());

    // HTTP Server
    const server = createServer(app);

    // WebSocket Server
    const wss = new WebSocket.Server({ server });

    // Setup WebSocket handlers
    setupWebSocketServer(wss);

    // Setup HTTP routes
    setupRoutes(app);

    server.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      await cleanup();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function cleanup() {
  // Implement cleanup logic
  logger.info('Cleaning up resources...');
}

startServer();
