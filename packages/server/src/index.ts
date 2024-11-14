import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/logger';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  logger.info('New client connected');

  ws.on('message', (message) => {
    logger.info('Received:', message);
  });

  ws.on('close', () => {
    logger.info('Client disconnected');
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
