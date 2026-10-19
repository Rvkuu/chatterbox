import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestClient, sessionCookie, sessionIdOf, setCookies, USER_A } from './test/client.js';
import { createTestApp, resetDatabase, type TestApp } from './test/helpers.js';

describe('POST /api/auth/logout', () => {
  let t: TestApp;
  let client: TestClient;
  beforeAll(() => {
    t = createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.db);
    client = new TestClient(t.app);
  });

  it('AT-O1: returns 204, clears the cookie and deletes the session row', async () => {
    await client.register(USER_A);
    const login = await client.post('/api/auth/login', {
      email: USER_A.email,
      password: USER_A.password,
    });
    const sid = sessionIdOf(sessionCookie(login));
    await client.refreshToken();

    const res = await client.post('/api/auth/logout');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const cleared = setCookies(res).find((c) => c.startsWith('chatterbox.sid='));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    const ids = (await t.db.$queryRaw<{ sid: string }[]>`SELECT sid FROM session`).map(
      (row) => row.sid,
    );
    expect(ids).not.toContain(sid);
  });

  it('AT-O2: a saved cookie no longer works after logout (SEC-T6)', async () => {
    await client.register(USER_A);
    const login = await client.post('/api/auth/login', {
      email: USER_A.email,
      password: USER_A.password,
    });
    const saved = sessionCookie(login);
    await client.refreshToken();
    expect((await request(t.app).get('/api/auth/me').set('Cookie', saved)).status).toBe(200);

    await client.post('/api/auth/logout');

    const replay = await request(t.app).get('/api/auth/me').set('Cookie', saved);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('AT-O3: logging out without being logged in is not an error', async () => {
    await client.refreshToken();

    const res = await client.post('/api/auth/logout');

    expect(res.status).toBe(204);
  });

  it('AT-O3: logging out twice in a row is fine', async () => {
    await client.signUp(USER_A);
    expect((await client.logout()).status).toBe(204);
    // The second call carries a fresh anonymous token, as the real client fetches after logout.
    expect((await client.logout()).status).toBe(204);
  });

  it('extra: logout needs a CSRF token', async () => {
    await client.signUp(USER_A);

    const res = await client.agent.post('/api/auth/logout').send({});

    expect(res.status).toBe(403);
    expect((await client.get('/api/auth/me')).status).toBe(200);
  });
});
