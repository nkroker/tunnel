import { Router } from 'express';
import { tunnelRoutes } from './tunnel';
import { authRoutes } from './auth';
import { metricsRoutes } from './metrics';

export function setupRoutes(app: Router) {
  // Auth routes
  app.use('/auth', authRoutes);

  // Tunnel management routes
  app.use('/tunnels', tunnelRoutes);

  // Metrics routes
  app.use('/metrics', metricsRoutes);

  // Health check
  app.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));
}
