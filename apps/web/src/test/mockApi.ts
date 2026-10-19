import { vi } from 'vitest';

export interface Call {
  method: string;
  path: string;
  body: unknown;
  token: string | null;
}

export interface Reply {
  status?: number;
  body?: unknown;
}

// A route handler may answer immediately or later (to model a slow API), or throw to model a
// network failure.
export type Handler = (call: Call) => Reply | Promise<Reply>;

export function json(status: number, body: unknown): Reply {
  return { status, body };
}

export const apiError = (
  status: number,
  code: string,
  message: string,
  fields?: object,
): Reply => ({
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});

// Stands in for fetch. Routes are keyed like "GET /auth/me" (the /api prefix is dropped). Anything
// not listed answers 404, so a test notices a request it did not expect. The CSRF endpoint and the
// health check have working defaults, and each token request returns a new token (token-1, ...).
export function mockApi(routes: Record<string, Handler | Reply> = {}) {
  const calls: Call[] = [];
  let tokens = 0;

  const defaults: Record<string, Handler | Reply> = {
    'GET /health': json(200, { status: 'ok', database: 'up' }),
    'GET /csrf-token': () => json(200, { csrfToken: `token-${++tokens}` }),
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^\/api/, '');
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const call: Call = {
      method,
      path,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      token: headers.get('X-CSRF-Token'),
    };
    calls.push(call);

    const route = routes[`${method} ${path}`] ?? defaults[`${method} ${path}`];
    const reply: Reply = route
      ? typeof route === 'function'
        ? await route(call)
        : route
      : apiError(404, 'NOT_FOUND', 'Not found.');

    const status = reply.status ?? 200;
    if (status === 204 || reply.body === undefined) {
      return new Response(null, { status });
    }
    return Response.json(reply.body, { status });
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    fetchMock,
    called: (key: string) => calls.filter((call) => `${call.method} ${call.path}` === key),
  };
}

export const anonymous: Record<string, Reply> = {
  'GET /auth/me': apiError(401, 'UNAUTHENTICATED', 'You need to log in.'),
};

export const ADA = { id: 'u1', username: 'ada_l', createdAt: '2026-10-16T11:19:54.000Z' };
