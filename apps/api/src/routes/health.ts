import { Router } from 'express';
import { isDatabaseUp, type Db } from '../db.js';

// docs/api.md: 200 when the API and the database are reachable, 503 when the database is not.
// The body never contains connection strings, versions or error text.
export function healthRouter(db: Db): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    if (await isDatabaseUp(db)) {
      res.json({ status: 'ok', database: 'up' });
    } else {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });
  return router;
}
