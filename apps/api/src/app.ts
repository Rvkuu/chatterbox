import express from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { consoleLogger, type Logger } from './logger.js';
import { csrfProtection, requireJson } from './middleware/csrf.js';
import { createErrorHandler, notFoundHandler } from './middleware/errors.js';
import { requestLogger } from './middleware/logging.js';
import { createSessionMiddleware } from './middleware/session.js';
import { createAuthService } from './services/auth.js';
import { createPasswordHasher, type PasswordHasher } from './services/passwords.js';
import { authRouter } from './routes/auth.js';
import { csrfRouter } from './routes/csrf.js';
import { healthRouter } from './routes/health.js';

export interface AppDeps {
  config: Config;
  db: Db;
  pool: Pool;
  logger?: Logger;
  // Replaceable so that tests can observe the hashing work (SEC-T4).
  hasher?: PasswordHasher;
}

// Builds the Express app without starting a server, so tests can use it directly.
export function createApp({
  config,
  db,
  pool,
  logger = consoleLogger,
  hasher = createPasswordHasher(),
}: AppDeps): express.Express {
  const app = express();

  app.disable('x-powered-by');
  if (config.cookieSecure) {
    // Behind the web container's proxy the request looks like plain HTTP unless we trust it.
    app.set('trust proxy', 1);
  }

  // docs/security.md section 10. This API only returns JSON, so the policy can be very strict.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(requestLogger(logger));

  const api = express.Router();
  // Health answers without a session, so it still works (and reports 503) when the database is down.
  api.use('/health', healthRouter(db));

  api.use(requireJson);
  api.use(express.json({ limit: '10kb' }));
  api.use(createSessionMiddleware(config, pool));
  api.use(csrfProtection(config));

  api.use('/csrf-token', csrfRouter);
  api.use('/auth', authRouter(config, createAuthService(db, hasher)));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
