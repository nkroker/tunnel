import { Router } from 'express';
import { setupHttpProxy } from '../websocket';
import { logger } from '../utils/logger';

const router: Router = Router();

// Handle all methods and paths under /tunnel/:tunnelId
router.all('/:tunnelId/*', (req, res) => {
  const tunnelId = req.params.tunnelId;
  const path = req.path.replace(`/${tunnelId}`, '');

  logger.info('Incoming tunnel request', {
    tunnelId,
    method: req.method,
    path,
    headers: req.headers,
    query: req.query
  });

  setupHttpProxy(req, res, tunnelId);
});

// Add a catch-all route for the root tunnel path
router.all('/:tunnelId', (req, res) => {
  const tunnelId = req.params.tunnelId;

  logger.info('Incoming tunnel root request', {
    tunnelId,
    method: req.method,
    headers: req.headers,
    query: req.query
  });

  setupHttpProxy(req, res, tunnelId);
});

export default router;
