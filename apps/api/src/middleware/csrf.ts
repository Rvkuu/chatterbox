import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Config } from '../config.js';
import { csrfInvalid, unsupportedMediaType } from '../errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// A new random token for a session (32 bytes, base64url).
export function newCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

// Layer 1 (docs/security.md section 6): a state-changing request must be JSON. A plain HTML form
// cannot send that content type across sites.
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!SAFE_METHODS.has(req.method) && !req.is('application/json')) {
    next(unsupportedMediaType());
    return;
  }
  next();
};

function tokensMatch(sent: unknown, expected: string | undefined): boolean {
  if (typeof sent !== 'string' || expected === undefined) {
    return false;
  }
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  // timingSafeEqual needs equal lengths. The token length is not a secret.
  return a.length === b.length && timingSafeEqual(a, b);
}

// Layers 2 and 3: the Origin header, if present, must be our web origin, and the X-CSRF-Token
// header must equal the token stored in the session. Layer 4 is SameSite=Lax on the cookie.
export function csrfProtection(config: Config): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.get('Origin');
    if (origin !== undefined && origin !== config.webOrigin) {
      next(csrfInvalid());
      return;
    }
    if (!tokensMatch(req.get('X-CSRF-Token'), req.session.csrfToken)) {
      next(csrfInvalid());
      return;
    }
    next();
  };
}
