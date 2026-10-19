import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestClient, sessionCookie, USER_A, USER_B } from './test/client.js';
import { createTestApp, resetDatabase, type TestApp } from './test/helpers.js';

describe('posts', () => {
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

  const postCount = () => t.db.post.count();

  // Creates a user directly in the database, so ordering tests do not need to log in.
  async function makeUser(user: { email: string; username: string }) {
    return t.db.user.create({
      data: {
        email: user.email,
        username: user.username,
        usernameKey: user.username.toLowerCase(),
        passwordHash: 'x',
      },
    });
  }

  const at = (iso: string) => new Date(iso);

  describe('GET /api/posts', () => {
    it('AT-F1: the feed is public: a visitor with no session gets 200', async () => {
      const res = await request(t.app).get('/api/posts');
      expect(res.status).toBe(200);
    });

    it("AT-F2: returns every user's posts, newest first", async () => {
      const ada = await makeUser(USER_A);
      const grace = await makeUser(USER_B);
      await t.db.post.createMany({
        data: [
          { authorId: ada.id, content: 'first', createdAt: at('2026-10-16T10:00:00Z') },
          { authorId: grace.id, content: 'second', createdAt: at('2026-10-16T11:00:00Z') },
          { authorId: ada.id, content: 'third', createdAt: at('2026-10-16T12:00:00Z') },
        ],
      });

      const res = await request(t.app).get('/api/posts');

      expect(res.body.posts.map((p: { content: string }) => p.content)).toEqual([
        'third',
        'second',
        'first',
      ]);
      expect(
        res.body.posts.map((p: { author: { username: string } }) => p.author.username),
      ).toEqual(['ada_l', 'grace_h', 'ada_l']);
    });

    it('AT-F3: posts with an identical timestamp always come back in the same order, by id descending', async () => {
      const ada = await makeUser(USER_A);
      const same = at('2026-10-16T10:00:00Z');
      await t.db.post.createMany({
        data: ['a', 'b', 'c', 'd', 'e', 'f'].map((content) => ({
          authorId: ada.id,
          content,
          createdAt: same,
        })),
      });

      const orders = await Promise.all(
        [1, 2, 3, 4].map(async () => {
          const res = await request(t.app).get('/api/posts');
          return res.body.posts.map((p: { id: string }) => p.id) as string[];
        }),
      );

      const expected = [...(orders[0] ?? [])].sort().reverse();
      expect(orders[0]).toEqual(expected);
      for (const order of orders) {
        expect(order).toEqual(orders[0]);
      }
    });

    it('AT-F4: each post has the author username, content and creation time, and no sensitive data', async () => {
      const ada = await makeUser(USER_A);
      await t.db.post.create({
        data: {
          authorId: ada.id,
          content: 'Hello, Chatterbox!',
          createdAt: at('2026-10-16T12:00:00Z'),
        },
      });

      const res = await request(t.app).get('/api/posts');

      const [post] = res.body.posts;
      expect(Object.keys(post).sort()).toEqual(['author', 'content', 'createdAt', 'id']);
      expect(Object.keys(post.author).sort()).toEqual(['id', 'username']);
      expect(post).toMatchObject({
        content: 'Hello, Chatterbox!',
        createdAt: '2026-10-16T12:00:00.000Z',
        author: { username: 'ada_l' },
      });
      expect(res.text).not.toMatch(/email|passwordHash|usernameKey|argon2|ada@example/i);
    });

    it('AT-F5: returns exactly the 100 newest of 105 posts', async () => {
      const ada = await makeUser(USER_A);
      const start = at('2026-10-16T00:00:00Z').getTime();
      await t.db.post.createMany({
        data: Array.from({ length: 105 }, (_unused, i) => ({
          authorId: ada.id,
          content: `post ${i + 1}`,
          createdAt: new Date(start + i * 60_000),
        })),
      });

      const res = await request(t.app).get('/api/posts');

      const contents: string[] = res.body.posts.map((p: { content: string }) => p.content);
      expect(contents).toHaveLength(100);
      expect(contents[0]).toBe('post 105');
      expect(contents[99]).toBe('post 6');
      for (const oldest of ['post 1', 'post 2', 'post 3', 'post 4', 'post 5']) {
        expect(contents).not.toContain(oldest);
      }
    });

    it('AT-F6: an empty feed is 200 with an empty posts array', async () => {
      const res = await request(t.app).get('/api/posts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ posts: [] });
    });

    it('AT-F9: the body is an object with a posts array, never a bare array', async () => {
      const ada = await makeUser(USER_A);
      await t.db.post.create({ data: { authorId: ada.id, content: 'x' } });

      const res = await request(t.app).get('/api/posts');

      expect(Array.isArray(res.body)).toBe(false);
      expect(Object.keys(res.body)).toEqual(['posts']);
      expect(Array.isArray(res.body.posts)).toBe(true);
    });
  });

  describe('POST /api/posts', () => {
    it('AT-P1: creates a post for the logged-in user, and it is first in the feed', async () => {
      await client.signUp(USER_A);

      const res = await client.post('/api/posts', { content: 'Hello, Chatterbox!' });

      expect(res.status).toBe(201);
      expect(res.body.post).toMatchObject({
        content: 'Hello, Chatterbox!',
        author: { username: 'ada_l' },
      });
      expect(Object.keys(res.body.post).sort()).toEqual(['author', 'content', 'createdAt', 'id']);
      const feed = await request(t.app).get('/api/posts');
      expect(feed.body.posts[0].id).toBe(res.body.post.id);
    });

    it('AT-P1: the post is stored with the session user as author', async () => {
      await client.signUp(USER_A);
      const res = await client.post('/api/posts', { content: 'mine' });

      const row = await t.db.post.findUniqueOrThrow({ where: { id: res.body.post.id } });
      const user = await t.db.user.findUniqueOrThrow({ where: { email: USER_A.email } });
      expect(row.authorId).toBe(user.id);
    });

    it('AT-P2: a visitor with no session gets 401 and no row is created (SEC-T10)', async () => {
      await client.refreshToken();

      const res = await client.post('/api/posts', { content: 'hello' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(await postCount()).toBe(0);
    });

    it('AT-P2: a visitor with no session and no token at all also gets 401, not a CSRF error', async () => {
      const res = await request(t.app).post('/api/posts').send({ content: 'hello' });
      expect(res.status).toBe(401);
      expect(await postCount()).toBe(0);
    });

    it.each([
      ['an empty string', ''],
      ['only spaces', '     '],
      ['only tabs and newlines', '\t\n \r\n\t'],
    ])('AT-P3: refuses content that is %s', async (_name, content) => {
      await client.signUp(USER_A);

      const res = await client.post('/api/posts', { content });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields.content.length).toBeGreaterThan(0);
      expect(await postCount()).toBe(0);
    });

    it.each([
      ['280 ASCII characters', 'a'.repeat(280), true],
      ['281 ASCII characters', 'a'.repeat(281), false],
      ['280 emoji', '🙂'.repeat(280), true],
      ['281 emoji', '🙂'.repeat(281), false],
      ['280 characters surrounded by spaces', `   ${'a'.repeat(280)}   `, true],
    ])('AT-P4: %s is %s', async (_name, content, accepted) => {
      await client.signUp(USER_A);

      const res = await client.post('/api/posts', { content });

      expect(res.status).toBe(accepted ? 201 : 400);
      expect(await postCount()).toBe(accepted ? 1 : 0);
      if (accepted) {
        expect(res.body.post.content).toBe(content.trim());
      }
    });

    it('AT-P4: refuses content that is not text, and a body with no content', async () => {
      await client.signUp(USER_A);
      expect((await client.post('/api/posts', { content: 12345 })).status).toBe(400);
      expect((await client.post('/api/posts', {})).status).toBe(400);
      expect(await postCount()).toBe(0);
    });

    it('AT-P5: trims the content before storing and returning it', async () => {
      await client.signUp(USER_A);

      const res = await client.post('/api/posts', { content: '  hi  ' });

      expect(res.body.post.content).toBe('hi');
      expect((await t.db.post.findFirstOrThrow()).content).toBe('hi');
    });

    it.each(['author', 'authorId', 'id', 'createdAt'])(
      'AT-P6: refuses a body that includes %s, and creates no row (SEC-T9)',
      async (field) => {
        await client.signUp(USER_A);
        const grace = await makeUser(USER_B);

        const res = await client.post('/api/posts', { content: 'hello', [field]: grace.id });

        expect(res.status).toBe(400);
        expect(res.body.error.fields[field]).toEqual(['Unknown field.']);
        expect(await postCount()).toBe(0);
      },
    );

    it('AT-P7: the timestamp is set by the server, in UTC ISO 8601', async () => {
      await client.signUp(USER_A);
      const before = Date.now();

      const res = await client.post('/api/posts', { content: 'timed' });

      const after = Date.now();
      const created = new Date(res.body.post.createdAt).getTime();
      expect(res.body.post.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // A small allowance covers the database clock being read slightly before or after the test's.
      expect(created).toBeGreaterThanOrEqual(before - 1000);
      expect(created).toBeLessThanOrEqual(after + 1000);
    });

    it('AT-S3: injection strings in post content are stored unchanged as plain data', async () => {
      await client.signUp(USER_A);
      const content = `'; DROP TABLE posts; -- " OR 1=1 -- <script>alert(1)</script>`;

      const res = await client.post('/api/posts', { content });

      expect(res.status).toBe(201);
      expect(res.body.post.content).toBe(content);
      expect(await postCount()).toBe(1);
      expect((await request(t.app).get('/api/posts')).body.posts[0].content).toBe(content);
    });

    it('SEC-T6: after logout the old cookie gets 401 on POST /posts', async () => {
      await client.register(USER_A);
      const login = await client.post('/api/auth/login', {
        email: USER_A.email,
        password: USER_A.password,
      });
      const saved = sessionCookie(login);
      const token = await client.refreshToken();
      expect((await client.post('/api/posts', { content: 'before logout' })).status).toBe(201);

      await client.post('/api/auth/logout');

      const replay = await request(t.app)
        .post('/api/posts')
        .set('Cookie', saved)
        .set('X-CSRF-Token', token)
        .send({ content: 'after logout' });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('UNAUTHENTICATED');
      expect(await postCount()).toBe(1);
    });

    it('AT-L6: an expired session cannot create a post', async () => {
      await client.signUp(USER_A);
      await t.db.$executeRaw`UPDATE session SET expire = now() - interval '1 minute'`;

      const res = await client.post('/api/posts', { content: 'too late' });

      expect(res.status).toBe(401);
      expect(await postCount()).toBe(0);
    });

    it('AT-P1: two users post and both appear, each under their own name', async () => {
      const second = new TestClient(t.app);
      await client.signUp(USER_A);
      await second.signUp(USER_B);

      await client.post('/api/posts', { content: 'from ada' });
      await second.post('/api/posts', { content: 'from grace' });

      const feed = await request(t.app).get('/api/posts');
      const pairs = feed.body.posts.map((p: { content: string; author: { username: string } }) => [
        p.content,
        p.author.username,
      ]);
      expect(pairs).toEqual([
        ['from grace', 'grace_h'],
        ['from ada', 'ada_l'],
      ]);
    });

    it('extra: a session whose user was deleted gets 401 and creates no post', async () => {
      await client.signUp(USER_A);
      await t.db.$executeRaw`DELETE FROM users`;

      const res = await client.post('/api/posts', { content: 'ghost' });

      expect(res.status).toBe(401);
      expect(await postCount()).toBe(0);
    });
  });

  describe('endpoint rules', () => {
    it('AT-S1: every endpoint in docs/api.md section 4 follows its Auth column', async () => {
      const visitor = new TestClient(t.app);
      const member = new TestClient(t.app);
      await visitor.refreshToken();
      await member.signUp(USER_A);

      // [method, path, body, status for a visitor, status for a logged-in user]
      const table: [string, string, object | undefined, number, number][] = [
        ['GET', '/api/health', undefined, 200, 200],
        ['GET', '/api/csrf-token', undefined, 200, 200],
        ['GET', '/api/auth/me', undefined, 401, 200],
        ['GET', '/api/posts', undefined, 200, 200],
        ['POST', '/api/posts', { content: 'hello' }, 401, 201],
      ];

      for (const [method, path, body, visitorStatus, memberStatus] of table) {
        const send = (who: TestClient) => (method === 'GET' ? who.get(path) : who.post(path, body));
        expect((await send(visitor)).status, `visitor ${method} ${path}`).toBe(visitorStatus);
        expect((await send(member)).status, `member ${method} ${path}`).toBe(memberStatus);
      }

      // Register, login and logout need no session. They change the session, so each gets its own
      // client. Logout works with or without a logged-in user.
      const anonymous = new TestClient(t.app);
      await anonymous.refreshToken();
      expect((await anonymous.post('/api/auth/logout')).status).toBe(204);
      expect((await member.post('/api/auth/logout')).status).toBe(204);
      expect((await new TestClient(t.app).register(USER_B)).status).toBe(201);
      expect((await new TestClient(t.app).login(USER_A)).status).toBe(200);
    });

    it('extra: every state-changing endpoint refuses a request without a CSRF token', async () => {
      await client.signUp(USER_A);
      const endpoints: [string, object][] = [
        ['/api/auth/register', { ...USER_B }],
        ['/api/auth/login', { email: USER_A.email, password: USER_A.password }],
        ['/api/auth/logout', {}],
        ['/api/posts', { content: 'no token' }],
      ];

      for (const [path, body] of endpoints) {
        const res = await client.agent.post(path).send(body);
        expect(res.status, path).toBe(403);
        expect(res.body.error.code, path).toBe('CSRF_INVALID');
      }
      expect(await postCount()).toBe(0);
      expect(await t.db.user.count()).toBe(1);
    });

    it('extra: a state-changing endpoint also refuses a foreign Origin', async () => {
      await client.signUp(USER_A);
      const res = await client.agent
        .post('/api/posts')
        .set('X-CSRF-Token', client.token ?? '')
        .set('Origin', 'https://evil.example')
        .send({ content: 'cross-site' });
      expect(res.status).toBe(403);
      expect(await postCount()).toBe(0);
    });
  });
});
