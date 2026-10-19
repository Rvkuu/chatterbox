import type { RequestHandler } from 'express';

// Responses that carry or depend on a session must not be cached (docs/security.md section 5.3).
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
