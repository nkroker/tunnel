import { Request, Response } from 'express';
import { TunnelManager } from '../services/tunnel-manager';
import { logger } from '../utils/logger';
import { WSMessage, WSMessageType } from '@tunnel/common';

export const handleTunnelRequest = async (req: Request, res: Response) => {
  try {
    // Extract tunnel ID from subdomain
    const host = req.headers.host || '';
    const tunnelId = host.split('.')[0];

    if (!tunnelId) {
      return res.status(400).send('Invalid tunnel ID');
    }

    const tunnelManager = TunnelManager.getInstance();
    const ws = tunnelManager.getTunnel(tunnelId);

    if (!ws) {
      return res.status(404).send('Tunnel not found');
    }

    const message: WSMessage = {
      type: WSMessageType.REQUEST,
      tunnelId: tunnelId,
      payload: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
      },
      timestamp: Date.now()
    };

    // Send request to tunnel client
    ws.send(JSON.stringify(message));

    // Wait for response
    const response = await tunnelManager.waitForResponse(tunnelId);

    // Send response back to original requester
    res.status(response.statusCode)
       .set(response.headers)
       .send(response.body);

  } catch (error) {
    logger.error('Error handling tunnel request:', error);
    res.status(500).send('Internal Server Error');
  }
};
