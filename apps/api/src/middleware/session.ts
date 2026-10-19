import connectPgSimple from 'connect-pg-simple';
import type { RequestHandler } from 'express';
import session from 'express-session';
import type { Pool } from 'pg';
import type { Config } from '../config.js';

// What the server keeps in a session. The browser only ever holds the signed session ID.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

export const SESSION_COOKIE_NAME = 'chatterbox.sid';
// SEC4: an anonymous session only holds a CSRF token. A logged-in session is absolute, not extended.
export const ANONYMOUS_SESSION_MS = 60 * 60 * 1000;
export const USER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
// S3-2: expired sessions are deleted every 15 minutes. Expired rows are never honoured in between.
const PRUNE_INTERVAL_SECONDS = 15 * 60;

// Server-side sessions in the `session` table that the Prisma migration creates (SEC2, DB6).
export function createSessionMiddleware(config: Config, pool: Pool): RequestHandler {
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
    pruneSessionInterval: PRUNE_INTERVAL_SECONDS,
  });

  return session({
    store,
    name: SESSION_COOKIE_NAME,
    secret: config.sessionSecret,
    resave: false,
    // No cookie and no row until something is stored, so visitors do not each create a session.
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: ANONYMOUS_SESSION_MS,
    },
  });
}

// express-session reports a failed save only after it has already sent the response, so a request
// could succeed with a cookie for a session that was never stored. Routes save explicitly instead,
// so a failure becomes an error response (docs/api.md: 503 when the database is unreachable).
export function saveSession(sess: session.Session): Promise<void> {
  return new Promise((resolve, reject) => {
    sess.save((err: unknown) => (err ? reject(toError(err)) : resolve()));
  });
}

// Replaces the session with a new one that has a new ID, deleting the old row (FR-02.3).
export function regenerateSession(sess: session.Session): Promise<void> {
  return new Promise((resolve, reject) => {
    sess.regenerate((err: unknown) => (err ? reject(toError(err)) : resolve()));
  });
}

export function destroySession(sess: session.Session): Promise<void> {
  return new Promise((resolve, reject) => {
    sess.destroy((err: unknown) => (err ? reject(toError(err)) : resolve()));
  });
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error('Session store error');
}
