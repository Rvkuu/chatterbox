import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestClient, sessionCookie, USER_A } from './test/client.js';
import { createTestApp, resetDatabase, type TestApp } from './test/helpers.js';

describe('CSRF protection, errors and logging', () => {
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

  const body = { email: USER_A.email, password: USER_A.password };

  it('SEC-T7: a POST without the token and a POST with a wrong token both get 403 CSRF_INVALID', async () => {
    await client.refreshToken();

    const missing = await client.agent.post('/api/auth/login').send(body);
    const wrong = await client.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', 'x'.repeat(43))
      .send(body);

    for (const res of [missing, wrong]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    }
  });

  it('SEC-T7: a POST with no session at all gets 403', async () => {
    const res = await request(t.app).post('/api/auth/login').send(body);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it("SEC-T7: a token from someone else's session is rejected", async () => {
    const other = new TestClient(t.app);
    const foreignToken = await other.refreshToken();
    await client.refreshToken();

    const res = await client.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', foreignToken)
      .send(body);

    expect(res.status).toBe(403);
  });

  it('SEC-T7: a correct token passes the CSRF check and reaches the login rules', async () => {
    const res = await client.post('/api/auth/login', body);
    expect(res.status).toBe(401);
  });

  it('SEC-T8: a POST from a different Origin is refused even with a valid token', async () => {
    const token = await client.refreshToken();

    const res = await client.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .set('Origin', 'https://evil.example')
      .send(body);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('SEC-T8: a POST from the web origin, or with no Origin header, is accepted', async () => {
    const token = await client.refreshToken();

    const same = await client.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .set('Origin', 'http://localhost:5173')
      .send(body);
    const none = await client.agent.post('/api/auth/login').set('X-CSRF-Token', token).send(body);

    expect(same.status).toBe(401);
    expect(none.status).toBe(401);
  });

  it('AT-S2: unknown route, malformed JSON, wrong content type, big body and invalid body use the error format', async () => {
    const token = await client.refreshToken();
    const post = () => client.agent.post('/api/auth/login').set('X-CSRF-Token', token);

    const notFound = await request(t.app).get('/api/does-not-exist');
    const malformed = await post().set('Content-Type', 'application/json').send('{"email":');
    const wrongType = await post().set('Content-Type', 'text/plain').send('email=a&password=b');
    const tooBig = await post().send({ email: 'a@b.co', password: 'x'.repeat(11 * 1024) });
    const invalid = await post().send({ email: 5 });

    expect([notFound, malformed, wrongType, tooBig, invalid].map((res) => res.status)).toEqual([
      404, 400, 415, 400, 400,
    ]);
    expect(wrongType.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    for (const res of [notFound, malformed, wrongType, tooBig, invalid]) {
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(res.body.error.code).toMatch(/^[A-Z_]+$/);
      expect(typeof res.body.error.message).toBe('string');
      expect(res.text).not.toMatch(
        /stack|node_modules|\.ts|at \w+ \(|SELECT|INSERT|prisma|postgres/i,
      );
    }
  });

  it('AT-S2: a POST with a JSON content type and no body is a field-level validation error', async () => {
    const token = await client.refreshToken();
    const res = await client.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'password']);
  });

  it('AT-S2: a POST with no content type is refused with 415', async () => {
    const token = await client.refreshToken();
    const res = await client.agent.post('/api/auth/login').set('X-CSRF-Token', token);
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('AT-S3: injection strings are rejected by validation or kept as plain data', async () => {
    const sql = "'; DROP TABLE users; --";
    const quote = '" OR 1=1 --';

    const badUsername = await client.post('/api/auth/register', {
      ...USER_A,
      username: sql,
    });
    const badEmail = await client.post('/api/auth/register', {
      ...USER_A,
      email: `${quote}@example.com`,
    });
    // A password may contain any characters, so this one is accepted and stored only as a hash.
    const odd = await client.post('/api/auth/register', { ...USER_A, password: "' OR '1'='1' --" });
    const loginWithSql = await client.post('/api/auth/login', { email: sql, password: quote });

    expect(badUsername.status).toBe(400);
    expect(badEmail.status).toBe(400);
    expect(odd.status).toBe(201);
    expect(loginWithSql.status).toBe(401);

    // The tables are intact and hold exactly the one account.
    expect(await t.db.user.count()).toBe(1);
    const row = await t.db.user.findFirstOrThrow();
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('AT-S5: passwords, cookies and tokens never appear in the log', async () => {
    const token = await client.refreshToken();
    const registered = await client.register(USER_A);
    const login = await client.post('/api/auth/login', {
      email: USER_A.email,
      password: USER_A.password,
    });
    const cookie = sessionCookie(login);
    await client.post('/api/auth/login', { email: USER_A.email, password: 'wrong password value' });
    await client.agent.get('/api/auth/me?token=' + token);

    const log = t.logs.text();
    expect(registered.status).toBe(201);
    expect(log).toContain('/api/auth/login');
    expect(log).not.toContain(USER_A.password);
    expect(log).not.toContain('wrong password value');
    expect(log).not.toContain(token);
    expect(log).not.toContain(cookie.slice('chatterbox.sid='.length));
    // The query string is left out of the log completely.
    expect(log).not.toContain('?token=');
  });
});
