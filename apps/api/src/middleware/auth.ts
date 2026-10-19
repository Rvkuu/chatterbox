import type { Request, RequestHandler } from 'express';
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

// The id of the logged-in user. Only call this after `requireAuth`.
export function currentUserId(req: Request): string {
  const id = req.session.userId;
  if (id === undefined) {
    throw unauthenticated();
  }
  return id;
}
