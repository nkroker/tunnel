import express, { Express, Router } from 'express';
import tunnelRouter from './tunnel';
import authRouter from './auth';
import metricsRouter from './metrics';
import healthRouter from './health';

// Create a setup function that takes the Express app as a parameter
export const setupRoutes = (app: Express): void => {
  const router = Router();

  // Health check route should be first
  router.use('/health', healthRouter);

  router.use('/tunnel', tunnelRouter);
  router.use('/auth', authRouter);
  router.use('/metrics', metricsRouter);

  // Apply the router to the app
  app.use(router);
};
