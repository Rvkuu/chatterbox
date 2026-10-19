import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestClient, USER_A, USER_B } from './test/client.js';
import { createTestApp, resetDatabase, type TestApp } from './test/helpers.js';

describe('POST /api/auth/register', () => {
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

  const userCount = () => t.db.user.count();

  it('AT-R1: registers a new account and returns only id, username and createdAt', async () => {
    const res = await client.register(USER_A);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.user).sort()).toEqual(['createdAt', 'id', 'username']);
    expect(res.body.user.username).toBe('ada_l');
    expect(new Date(res.body.user.createdAt).toISOString()).toBe(res.body.user.createdAt);
    expect(res.text).not.toMatch(/email|password|hash|argon2|ada@example/i);

    // The new account can log in.
    expect((await client.login(USER_A)).status).toBe(200);
  });

  it('SEC-T2: the register and login responses contain no email and no hash fields', async () => {
    const registered = await client.register(USER_A);
    const loggedIn = await client.login(USER_A);
    for (const res of [registered, loggedIn]) {
      expect(res.text).not.toMatch(/email|passwordHash|\$argon2/i);
      expect(Object.keys(res.body.user).sort()).toEqual(['createdAt', 'id', 'username']);
    }
  });

  it('AT-R2: stores the password only as an Argon2id hash (SEC-T1)', async () => {
    await client.register(USER_A);

    const row = await t.db.user.findUniqueOrThrow({ where: { email: USER_A.email } });
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row.passwordHash).not.toBe(USER_A.password);
    expect(JSON.stringify(row)).not.toContain(USER_A.password);
  });

  it('AT-R3: stores the email trimmed and lower-cased, and logs in with the clean address', async () => {
    const res = await client.register({ ...USER_A, email: '  Ada@Example.COM ' });
    expect(res.status).toBe(201);

    const row = await t.db.user.findFirstOrThrow();
    expect(row.email).toBe('ada@example.com');
    expect(
      (await client.login({ email: 'ada@example.com', password: USER_A.password })).status,
    ).toBe(200);
  });

  it.each([
    ['a missing field', { email: USER_A.email, username: USER_A.username }, 'password'],
    ['a wrong type', { ...USER_A, username: 12345 }, 'username'],
    ['an email with no @', { ...USER_A, email: 'ada.example.com' }, 'email'],
    [
      'an email over 254 characters',
      { ...USER_A, email: `${'a'.repeat(250)}@example.com` },
      'email',
    ],
    ['a 2 character username', { ...USER_A, username: 'ab' }, 'username'],
    ['a 31 character username', { ...USER_A, username: 'a'.repeat(31) }, 'username'],
    ['a username with a space', { ...USER_A, username: 'ada l' }, 'username'],
    ['a username with a hyphen', { ...USER_A, username: 'ada-l' }, 'username'],
    ['an 11 character password', { ...USER_A, password: 'x'.repeat(11) }, 'password'],
    ['a 129 character password', { ...USER_A, password: 'x'.repeat(129) }, 'password'],
  ])(
    'AT-R4: rejects %s with a field-level 400 and creates no account',
    async (_name, body, field) => {
      const res = await client.post('/api/auth/register', body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields[field].length).toBeGreaterThan(0);
      expect(await userCount()).toBe(0);
    },
  );

  it('AT-R5: rejects an unknown field and creates no account', async () => {
    const res = await client.post('/api/auth/register', { ...USER_A, role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.role).toEqual(['Unknown field.']);
    expect(await userCount()).toBe(0);
  });

  it('AT-R6: rejects a duplicate email in any capitalisation with a 409 on the email field', async () => {
    await client.register(USER_A);

    const res = await client.register({ ...USER_B, email: 'ADA@Example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'Could not create the account.',
        fields: { email: ['Already registered.'] },
      },
    });
    expect(await userCount()).toBe(1);
  });

  it('AT-R7: rejects a duplicate username in any capitalisation (SEC-T13)', async () => {
    await client.register(USER_A);

    const res = await client.register({ ...USER_B, username: 'ADA_L' });

    expect(res.status).toBe(409);
    expect(res.body.error.fields).toEqual({ username: ['Already taken.'] });
    expect(await userCount()).toBe(1);
  });

  it('AT-R6: names both fields when both are taken', async () => {
    await client.register(USER_A);
    const res = await client.register(USER_A);
    expect(res.status).toBe(409);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'username']);
  });

  it('AT-R8: two simultaneous identical registrations give one 201 and one 409, never a 500', async () => {
    const first = new TestClient(t.app);
    const second = new TestClient(t.app);
    await Promise.all([first.refreshToken(), second.refreshToken()]);

    const results = await Promise.all([first.register(USER_A), second.register(USER_A)]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await userCount()).toBe(1);
  });

  it('AT-R9: registering does not log the user in', async () => {
    await client.register(USER_A);

    const me = await client.get('/api/auth/me');

    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('extra: registering needs a CSRF token', async () => {
    const res = await client.agent.post('/api/auth/register').send(USER_A);
    expect(res.status).toBe(403);
    expect(await userCount()).toBe(0);
  });
});
