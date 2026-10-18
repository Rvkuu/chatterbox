import { Router } from 'express';

export const healthRouter = Router();

// Liveness only. api.md also requires a database check, which is added in S3-1.
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});
