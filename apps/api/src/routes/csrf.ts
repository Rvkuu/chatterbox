import { Router } from 'express';
import { newCsrfToken } from '../middleware/csrf.js';
import { noStore } from '../middleware/noStore.js';
import { saveSession } from '../middleware/session.js';

export const csrfRouter = Router();

// The first call creates a short-lived anonymous session that holds the token (docs/security.md
// section 5.1). Later calls return the same token until the session changes.
csrfRouter.get('/', noStore, async (req, res) => {
  req.session.csrfToken ??= newCsrfToken();
  await saveSession(req.session);
  res.json({ csrfToken: req.session.csrfToken });
});
