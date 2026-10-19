import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { TestUser } from './fixtures';

// Talks to the API through the web container, the way any HTTP client would. It keeps cookies, and
// sends the CSRF token on every POST.
export class ApiSession {
  private token: string | undefined;

  constructor(readonly ctx: APIRequestContext) {}

  async refreshToken(): Promise<string> {
    const res = await this.ctx.get('/api/csrf-token');
    this.token = ((await res.json()) as { csrfToken: string }).csrfToken;
    return this.token;
  }

  get(path: string): Promise<APIResponse> {
    return this.ctx.get(path);
  }

  async post(path: string, data: object = {}): Promise<APIResponse> {
    const token = this.token ?? (await this.refreshToken());
    return this.ctx.post(path, { data, headers: { 'X-CSRF-Token': token } });
  }

  async signUp(user: TestUser): Promise<void> {
    await this.post('/api/auth/register', user);
    await this.post('/api/auth/login', { email: user.email, password: user.password });
    await this.refreshToken();
  }
}
