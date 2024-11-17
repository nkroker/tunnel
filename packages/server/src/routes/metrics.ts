import { Router } from 'express';

const router: Router = Router();

// Basic metrics routes
router.get('/', (req, res) => {
  res.json({
    activeConnections: 0,
    totalRequests: 0,
    // Add more metrics as needed
  });
});

router.get('/:tunnelId', (req, res) => {
  const { tunnelId } = req.params;
  res.json({
    tunnelId,
    requests: 0,
    // Add tunnel-specific metrics
  });
});

export default router;
