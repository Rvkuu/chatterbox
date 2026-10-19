import { Router } from 'express';
import type { Config } from '../config.js';
import { unauthenticated } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { newCsrfToken } from '../middleware/csrf.js';
import { noStore } from '../middleware/noStore.js';
import {
  destroySession,
  regenerateSession,
  saveSession,
  SESSION_COOKIE_NAME,
  USER_SESSION_MS,
} from '../middleware/session.js';
import type { AuthService } from '../services/auth.js';
import { loginSchema, parseBody, registerSchema } from '../validation/schemas.js';

export function authRouter(config: Config, service: AuthService): Router {
  const router = Router();
  router.use(noStore);

  // Creates the account only. The caller then logs in, so registering never changes the session
  // (docs/api.md decision D7, AT-R9).
  router.post('/register', async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    const user = await service.register(input);
    res.status(201).json({ user });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const user = await service.login(email, password);

    // FR-02.3: a new session ID, so a session ID planted before login is useless (session
    // fixation). The old row is deleted. The new session gets a new CSRF token and lasts 7 days.
    await regenerateSession(req.session);
    req.session.userId = user.id;
    req.session.csrfToken = newCsrfToken();
    req.session.cookie.maxAge = USER_SESSION_MS;
    await saveSession(req.session);

    res.json({ user });
  });

  // Idempotent: with no active session it still answers 204 (docs/api.md decision D8).
  router.post('/logout', async (req, res) => {
    await destroySession(req.session);
    res.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
    });
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const user = userId === undefined ? null : await service.findUser(userId);
    if (user === null) {
      // The session points at a user that no longer exists, so it must not keep working.
      await destroySession(req.session);
      throw unauthenticated();
    }
    res.json({ user });
  });

  return router;
}
