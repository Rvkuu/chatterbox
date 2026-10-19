import { Router } from 'express';
import type { Config } from '../config.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import type { PostsService } from '../services/posts.js';
import { createPostSchema, parseBody } from '../validation/schemas.js';

export function postsRouter(config: Config, service: PostsService): Router {
  const router = Router();

  // Public (FR-04.1). An object, never a bare array, so pagination can be added later (NFR-X3).
  router.get('/', async (_req, res) => {
    res.json({ posts: await service.feed() });
  });

  // Authentication comes first. A request with no session has nothing to protect from forgery,
  // and it must get 401 even if it carries an old token (FR-03.3, SEC-T6). Then the CSRF checks.
  router.post('/', requireAuth, csrfProtection(config), async (req, res) => {
    const { content } = parseBody(createPostSchema, req.body);
    const post = await service.create(currentUserId(req), content);
    res.status(201).json({ post });
  });

  return router;
}
