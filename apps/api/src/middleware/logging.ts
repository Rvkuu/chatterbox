import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../logger.js';

// Logs method, path, status and duration for each request. The query string is left out, and so
// are headers and bodies, because they can carry cookies, tokens and passwords.
export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const requestId = randomUUID();
    const started = process.hrtime.bigint();
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => {
      logger.info({
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
      });
    });
    next();
  };
}
