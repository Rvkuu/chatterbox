import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase, type TestApp } from './test/helpers.js';

function cookieOf(res: request.Response): string {
  const header = res.headers['set-cookie'];
  const first = Array.isArray(header) ? header[0] : undefined;
  if (first === undefined) {
    throw new Error('No Set-Cookie header in the response');
  }
  return first;
}

describe('sessions in PostgreSQL', () => {
  let t: TestApp;
  beforeAll(() => {
    t = createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.db);
  });

  it('extra: GET /csrf-token creates an anonymous session row in PostgreSQL', async () => {
    const res = await request(t.app).get('/api/csrf-token');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const rows = await t.db.$queryRaw<{ sess: { csrfToken: string; userId?: string } }[]>`
      SELECT sess FROM session`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sess.csrfToken).toBe(res.body.csrfToken);
    expect(rows[0]?.sess.userId).toBeUndefined();
  });

  it('extra: the session cookie follows the documented attributes (SEC3)', async () => {
    const before = Date.now();
    const res = await request(t.app).get('/api/csrf-token');
    const cookie = cookieOf(res);

    expect(cookie.startsWith('chatterbox.sid=')).toBe(true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Domain');
    // Local development runs over HTTP, so Secure is off here.
    expect(cookie).not.toContain('Secure');
    // The cookie carries only the signed session ID, never the CSRF token or any user data.
    expect(cookie).not.toContain(res.body.csrfToken);

    // SEC4: an anonymous session lasts one hour.
    const expires = /Expires=([^;]+)/.exec(cookie)?.[1] ?? '';
    const lifetime = new Date(expires).getTime() - before;
    expect(lifetime).toBeGreaterThan(59 * 60 * 1000);
    expect(lifetime).toBeLessThan(61 * 60 * 1000);
  });

  it('extra: the cookie is Secure when COOKIE_SECURE is on and the proxy says HTTPS', async () => {
    const secure = createTestApp({ COOKIE_SECURE: 'true' });
    try {
      const res = await request(secure.app)
        .get('/api/csrf-token')
        .set('X-Forwarded-Proto', 'https');
      expect(cookieOf(res)).toContain('Secure');
    } finally {
      await secure.close();
    }
  });

  it('extra: session responses are not cacheable', async () => {
    const res = await request(t.app).get('/api/csrf-token');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('AT-D6: a session survives an API restart, because it lives in PostgreSQL', async () => {
    const first = await request(t.app).get('/api/csrf-token');
    const cookie = cookieOf(first).split(';')[0] ?? '';

    // A second app with its own connection pool and no shared memory is a restarted API.
    const restarted = createTestApp();
    try {
      const again = await request(restarted.app).get('/api/csrf-token').set('Cookie', cookie);
      expect(again.status).toBe(200);
      expect(again.body.csrfToken).toBe(first.body.csrfToken);
    } finally {
      await restarted.close();
    }
  });

  it('extra: a session past its expiry time is not honoured', async () => {
    const first = await request(t.app).get('/api/csrf-token');
    const cookie = cookieOf(first).split(';')[0] ?? '';

    await t.db.$executeRaw`UPDATE session SET expire = now() - interval '1 minute'`;

    const again = await request(t.app).get('/api/csrf-token').set('Cookie', cookie);
    expect(again.body.csrfToken).not.toBe(first.body.csrfToken);
  });

  it('extra: a cookie signed with a different secret is ignored', async () => {
    const other = createTestApp({ SESSION_SECRET: 'a-completely-different-secret-value' });
    try {
      const foreign = await request(other.app).get('/api/csrf-token');
      const cookie = cookieOf(foreign).split(';')[0] ?? '';
      const res = await request(t.app).get('/api/csrf-token').set('Cookie', cookie);
      expect(res.body.csrfToken).not.toBe(foreign.body.csrfToken);
    } finally {
      await other.close();
    }
  });
});
