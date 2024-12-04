import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { logger } from './utils/logger';
import { WSMessage, WSMessageType } from '@tunnel/common';
import crypto from 'crypto';
import debug from 'debug';

const serverLog = debug('tunnel:server');
const wsLog = debug('tunnel:server:ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map<string, WebSocket>();

// Add health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    let tunnelId: string | undefined;

    ws.on('message', async (data: Buffer) => {
        try {
            const message: WSMessage = JSON.parse(data.toString());

            if (message.type === WSMessageType.CONNECT) {
                tunnelId = message.tunnelId;
                clients.set(tunnelId, ws);
                wsLog(`Client connected with tunnel ID: ${tunnelId}`);
            }
        } catch (error) {
            wsLog('Error processing WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        if (tunnelId) {
            clients.delete(tunnelId);
            wsLog(`Client disconnected: ${tunnelId}`);
        }
    });
});

// Handle all non-health-check requests
app.use(async (req, res, next) => {
    // Skip this middleware for health check endpoint
    if (req.path === '/health') {
        return next();
    }

    const host = req.headers.host || '';
    const tunnelId = host.split('.')[0]; // Extract tunnel ID from subdomain

    serverLog(`Incoming request: ${req.method} ${host}${req.path}`);

    // Check if we have a client for this tunnel
    const client = clients.get(tunnelId);
    if (!client) {
        serverLog(`No client found for tunnel: ${tunnelId}`);
        return res.status(404).send('Tunnel not found');
    }

    // Collect request body
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const requestId = crypto.randomBytes(16).toString('hex');

            // Create request message
            const message: WSMessage = {
                type: WSMessageType.REQUEST,
                tunnelId: tunnelId,
                payload: {
                    requestId,
                    method: req.method || 'GET',
                    url: req.url,
                    headers: req.headers,
                    body
                },
                timestamp: Date.now()
            };

            serverLog(`Forwarding request to client: ${requestId}`);

            // Set up response timeout
            const timeout = setTimeout(() => {
                serverLog(`Request timeout: ${requestId}`);
                if (!res.headersSent) {
                    res.status(504).send('Gateway Timeout');
                }
            }, 30000);

            // Set up response handler
            const responseHandler = (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString());

                    if (response.type === WSMessageType.RESPONSE &&
                        response.payload.requestId === requestId) {
                        clearTimeout(timeout);
                        client.removeListener('message', responseHandler);

                        if (!res.headersSent) {
                            res.writeHead(response.payload.statusCode, response.payload.headers);
                            res.end(response.payload.body);
                            serverLog(`Response sent for request: ${requestId}`);
                        }
                    }
                } catch (error) {
                    serverLog('Error processing response:', error);
                    if (!res.headersSent) {
                        res.status(500).send('Internal Server Error');
                    }
                }
            };

            // Listen for response
            client.on('message', responseHandler);

            // Send request to client
            client.send(JSON.stringify(message));
            serverLog(`Request sent to client: ${requestId}`);

        } catch (error) {
            serverLog('Error processing request:', error);
            if (!res.headersSent) {
                res.status(500).send('Internal Server Error');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    serverLog(`Server listening on port ${PORT}`);
    logger.info(`Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', () => {
    serverLog('Shutting down server...');
    wss.close(() => {
        serverLog('WebSocket server closed');
        server.close(() => {
            serverLog('HTTP server closed');
            process.exit(0);
        });
    });
});
