import { Express } from 'express';
import { handleTunnelRequest } from './tunnel';

export const setupRoutes = (app: Express) => {
  // Add any other routes here
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (host.split('.').length > 2) {
      return handleTunnelRequest(req, res);
    }
    next();
  });
};
