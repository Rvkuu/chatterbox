import type { RequestHandler } from 'express';
import { unauthenticated } from '../errors.js';

// NFR-S2: protected endpoints reject requests without a logged-in session. The user always comes
// from the session, never from the request.
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.session.userId === undefined) {
    next(unauthenticated());
    return;
  }
  next();
};
