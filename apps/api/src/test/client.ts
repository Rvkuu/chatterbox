import type { Express } from 'express';
import request from 'supertest';

// Test-only values from docs/acceptance-tests.md section 3. They are not real accounts.
export const USER_A = {
  email: 'ada@example.com',
  username: 'ada_l',
  password: 'correct horse battery staple',
};
export const USER_B = {
  email: 'grace@example.com',
  username: 'grace_h',
  password: 'another long test passphrase',
};

// Behaves like the browser: keeps cookies, and sends the CSRF token on every POST. A new token is
// fetched after login and logout, because the session changes then (docs/api.md section 4).
export class TestClient {
  readonly agent: ReturnType<typeof request.agent>;
  token: string | undefined;

  constructor(readonly app: Express) {
    this.agent = request.agent(app);
  }

  async refreshToken(): Promise<string> {
    const res = await this.agent.get('/api/csrf-token');
    this.token = (res.body as { csrfToken: string }).csrfToken;
    return this.token;
  }

  get(path: string): request.Test {
    return this.agent.get(path);
  }

  async post(path: string, body: unknown = {}): Promise<request.Response> {
    const token = this.token ?? (await this.refreshToken());
    return this.agent
      .post(path)
      .set('X-CSRF-Token', token)
      .send(body as object);
  }

  async register(user: {
    email: string;
    username: string;
    password: string;
  }): Promise<request.Response> {
    return this.post('/api/auth/register', user);
  }

  async login(user: { email: string; password: string }): Promise<request.Response> {
    const res = await this.post('/api/auth/login', { email: user.email, password: user.password });
    if (res.status === 200) {
      await this.refreshToken();
    }
    return res;
  }

  async logout(): Promise<request.Response> {
    const res = await this.post('/api/auth/logout');
    await this.refreshToken();
    return res;
  }

  // Creates the account, logs in, and returns the public user.
  async signUp(user: { email: string; username: string; password: string }): Promise<void> {
    const registered = await this.register(user);
    if (registered.status !== 201) {
      throw new Error(`Registration failed: ${registered.status}`);
    }
    const loggedIn = await this.login(user);
    if (loggedIn.status !== 200) {
      throw new Error(`Login failed: ${loggedIn.status}`);
    }
  }
}

// The cookie headers of a response, as the browser would receive them.
export function setCookies(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  if (header === undefined) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

// "chatterbox.sid=VALUE" without the attributes, ready to send back in a Cookie header.
export function sessionCookie(res: request.Response): string {
  const cookie = setCookies(res).find((c) => c.startsWith('chatterbox.sid='));
  if (cookie === undefined) {
    throw new Error('The response did not set the session cookie');
  }
  return cookie.split(';')[0] ?? '';
}

// The session ID inside the signed cookie value ("s:<id>.<signature>").
export function sessionIdOf(cookie: string): string {
  const value = decodeURIComponent(cookie.slice('chatterbox.sid='.length));
  return value.slice(2, value.lastIndexOf('.'));
}
