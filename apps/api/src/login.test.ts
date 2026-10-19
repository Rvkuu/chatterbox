import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPasswordHasher } from './services/passwords.js';
import { TestClient, sessionCookie, sessionIdOf, setCookies, USER_A } from './test/client.js';
import { createTestApp, resetDatabase, type TestApp } from './test/helpers.js';

describe('login, current user and session expiry', () => {
  const realHasher = createPasswordHasher();
  const hasher = {
    ...realHasher,
    verify: vi.fn(realHasher.verify),
    verifyDummy: vi.fn(realHasher.verifyDummy),
  };

  let t: TestApp;
  let client: TestClient;
  beforeAll(() => {
    t = createTestApp({}, hasher);
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.db);
    client = new TestClient(t.app);
    hasher.verify.mockClear();
    hasher.verifyDummy.mockClear();
  });

  it('AT-L1: logs in, returns the user without an email, and sets a secure session cookie (SEC-T5)', async () => {
    await client.register(USER_A);
    const before = Date.now();

    const res = await client.post('/api/auth/login', {
      email: USER_A.email,
      password: USER_A.password,
    });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.user).sort()).toEqual(['createdAt', 'id', 'username']);
    expect(res.text).not.toMatch(/email|hash/i);

    const cookie = setCookies(res).find((c) => c.startsWith('chatterbox.sid='));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain');

    // SEC4: a logged-in session lasts 7 days.
    const expires = new Date(/Expires=([^;]+)/.exec(cookie ?? '')?.[1] ?? '').getTime();
    const days = (expires - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);

    const rows = await t.db.$queryRaw<{ sess: { userId?: string } }[]>`SELECT sess FROM session`;
    expect(rows.map((row) => row.sess.userId)).toContain(res.body.user.id);
  });

  it('AT-L2: replaces the session ID at login and deletes the old session (FR-02.3)', async () => {
    await client.register(USER_A);
    // A visitor holding an anonymous session cookie, as a browser would after loading the app.
    const anonymous = await request(t.app).get('/api/csrf-token');
    const oldCookie = sessionCookie(anonymous);
    const oldId = sessionIdOf(oldCookie);
    const token = (anonymous.body as { csrfToken: string }).csrfToken;

    const login = await request(t.app)
      .post('/api/auth/login')
      .set('Cookie', oldCookie)
      .set('X-CSRF-Token', token)
      .send({ email: USER_A.email, password: USER_A.password });
    const newCookie = sessionCookie(login);

    expect(login.status).toBe(200);
    expect(newCookie).not.toBe(oldCookie);
    expect(sessionIdOf(newCookie)).not.toBe(oldId);
    const ids = (await t.db.$queryRaw<{ sid: string }[]>`SELECT sid FROM session`).map(
      (row) => row.sid,
    );
    expect(ids).not.toContain(oldId);
    expect(ids).toContain(sessionIdOf(newCookie));
  });

  it('AT-L3: a wrong password and an unknown email give the identical 401 (SEC-T3)', async () => {
    await client.register(USER_A);

    const wrongPassword = await client.post('/api/auth/login', {
      email: USER_A.email,
      password: 'not the right password',
    });
    const unknownEmail = await client.post('/api/auth/login', {
      email: 'nobody@example.com',
      password: 'not the right password',
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
    });
    expect(
      setCookies(wrongPassword).some(
        (c) => c.startsWith('chatterbox.sid=') && c.includes('Max-Age=0'),
      ),
    ).toBe(false);
  });

  it('SEC-T4: an unknown email still runs the dummy-hash verification, and a real one does not', async () => {
    await client.register(USER_A);

    await client.post('/api/auth/login', {
      email: 'nobody@example.com',
      password: 'whatever password',
    });
    expect(hasher.verifyDummy).toHaveBeenCalledTimes(1);
    expect(hasher.verify).not.toHaveBeenCalled();

    hasher.verifyDummy.mockClear();
    await client.post('/api/auth/login', { email: USER_A.email, password: 'wrong password here' });
    expect(hasher.verify).toHaveBeenCalledTimes(1);
    expect(hasher.verifyDummy).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing password', { email: USER_A.email }],
    ['a wrong type', { email: USER_A.email, password: 12345 }],
    ['an unknown field', { email: USER_A.email, password: USER_A.password, remember: true }],
    ['a body that is not an object', ['x']],
  ])('AT-L4: rejects %s with 400 and does not log in', async (_name, body) => {
    await client.register(USER_A);

    const res = await client.post('/api/auth/login', body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const rows = await t.db.$queryRaw<{ sess: { userId?: string } }[]>`SELECT sess FROM session`;
    expect(rows.every((row) => row.sess.userId === undefined)).toBe(true);
  });

  it('AT-L5: /me returns the current user, also on a later request with the same cookie', async () => {
    await client.signUp(USER_A);

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('ada_l');
    expect(me.text).not.toMatch(/email|hash/i);
  });

  it('AT-L5: /me without a session returns 401 UNAUTHENTICATED', async () => {
    const res = await request(t.app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'You need to log in.' },
    });
  });

  it('AT-L5: the session still works from a different request carrying only the cookie', async () => {
    await client.register(USER_A);
    const login = await client.post('/api/auth/login', {
      email: USER_A.email,
      password: USER_A.password,
    });

    const reloaded = await request(t.app).get('/api/auth/me').set('Cookie', sessionCookie(login));

    expect(reloaded.status).toBe(200);
    expect(reloaded.body.user.username).toBe('ada_l');
  });

  it('AT-L6: a session past its expiry time no longer authorises requests', async () => {
    await client.signUp(USER_A);
    expect((await client.get('/api/auth/me')).status).toBe(200);

    await t.db.$executeRaw`UPDATE session SET expire = now() - interval '1 minute'`;

    const res = await client.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('extra: login gives the session a new CSRF token, so the old one stops working', async () => {
    await client.register(USER_A);
    const oldToken = await client.refreshToken();

    await client.post('/api/auth/login', { email: USER_A.email, password: USER_A.password });
    const withOld = await client.agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', oldToken)
      .send({});

    expect(withOld.status).toBe(403);
    expect(withOld.body.error.code).toBe('CSRF_INVALID');
  });

  it('extra: replaces an older password hash with the current parameters on a successful login', async () => {
    const weak = await argon2.hash(USER_A.password, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 2,
      parallelism: 1,
    });
    await t.db.user.create({
      data: { email: USER_A.email, username: 'ada_l', usernameKey: 'ada_l', passwordHash: weak },
    });

    const res = await client.login(USER_A);

    expect(res.status).toBe(200);
    const row = await t.db.user.findUniqueOrThrow({ where: { email: USER_A.email } });
    expect(row.passwordHash).not.toBe(weak);
    expect(row.passwordHash).toContain('m=19456,p=1,t=2');
    expect((await client.login(USER_A)).status).toBe(200);
  });

  it('extra: a stored value that is not a valid hash never authenticates anyone', async () => {
    await t.db.user.create({
      data: {
        email: USER_A.email,
        username: 'ada_l',
        usernameKey: 'ada_l',
        passwordHash: 'not-a-hash',
      },
    });
    const res = await client.login(USER_A);
    expect(res.status).toBe(401);
  });

  it('extra: a session whose user was deleted is rejected and removed', async () => {
    await client.signUp(USER_A);
    await t.db.$executeRaw`DELETE FROM users`;

    const res = await client.get('/api/auth/me');

    expect(res.status).toBe(401);
    const rows = await t.db.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM session WHERE sess::text LIKE '%userId%'`;
    expect(Number(rows[0]?.n)).toBe(0);
  });
});
