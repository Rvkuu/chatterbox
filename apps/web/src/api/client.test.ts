import { describe, expect, it } from 'vitest';
import { createPost, getPosts, login, logout } from './endpoints';
import { ApiRequestError, NetworkError, postJson } from './client';
import { ADA, apiError, json, mockApi } from '../test/mockApi';

const POST = {
  id: 'p1',
  content: 'hi',
  createdAt: '2026-10-16T12:00:00.000Z',
  author: { id: 'u1', username: 'ada_l' },
};

describe('API client: CSRF handling', () => {
  it('AT-S4: fetches a token before the first POST and sends it in X-CSRF-Token', async () => {
    const api = mockApi({ 'POST /posts': json(201, { post: POST }) });

    await createPost('hi');

    expect(api.called('GET /csrf-token')).toHaveLength(1);
    expect(api.called('POST /posts')[0]?.token).toBe('token-1');
  });

  it('AT-S4: reuses the token for later POSTs instead of fetching again', async () => {
    const api = mockApi({ 'POST /posts': json(201, { post: POST }) });

    await createPost('one');
    await createPost('two');

    expect(api.called('GET /csrf-token')).toHaveLength(1);
    expect(api.called('POST /posts').map((call) => call.token)).toEqual(['token-1', 'token-1']);
  });

  it('AT-S4: after a 403 CSRF_INVALID it fetches a new token and retries once', async () => {
    let attempts = 0;
    const api = mockApi({
      'POST /posts': () =>
        ++attempts === 1 ? apiError(403, 'CSRF_INVALID', 'Try again.') : json(201, { post: POST }),
    });

    const post = await createPost('hi');

    expect(post.id).toBe('p1');
    expect(api.called('POST /posts').map((call) => call.token)).toEqual(['token-1', 'token-2']);
  });

  it('AT-S4: shows the error if the retry is also refused, and does not retry again', async () => {
    const api = mockApi({ 'POST /posts': apiError(403, 'CSRF_INVALID', 'Try again.') });

    await expect(createPost('hi')).rejects.toMatchObject({ status: 403, code: 'CSRF_INVALID' });

    expect(api.called('POST /posts')).toHaveLength(2);
  });

  it('AT-S4: does not retry other errors', async () => {
    const api = mockApi({ 'POST /posts': apiError(400, 'VALIDATION_ERROR', 'Bad.') });

    await expect(createPost('hi')).rejects.toBeInstanceOf(ApiRequestError);

    expect(api.called('POST /posts')).toHaveLength(1);
  });

  it('AT-S4: uses a fresh token after login, because the session changed', async () => {
    const api = mockApi({
      'POST /auth/login': json(200, { user: ADA }),
      'POST /posts': json(201, { post: POST }),
    });

    await login({ email: 'ada@example.com', password: 'x'.repeat(12) });
    await createPost('hi');

    expect(api.called('POST /auth/login')[0]?.token).toBe('token-1');
    expect(api.called('POST /posts')[0]?.token).toBe('token-2');
  });

  it('AT-S4: uses a fresh token after logout, even when logout fails', async () => {
    let fail = true;
    const api = mockApi({
      'POST /auth/logout': () =>
        fail ? apiError(500, 'INTERNAL_ERROR', 'Oops.') : { status: 204 },
      'POST /posts': json(201, { post: POST }),
    });

    await expect(logout()).rejects.toBeInstanceOf(ApiRequestError);
    fail = false;
    await createPost('hi');

    expect(api.called('POST /posts')[0]?.token).toBe('token-2');
  });

  it('AT-S4: a logout with a stale token succeeds after one automatic retry', async () => {
    let attempts = 0;
    const api = mockApi({
      'POST /auth/logout': () =>
        ++attempts === 1 ? apiError(403, 'CSRF_INVALID', 'Stale.') : { status: 204 },
    });

    await expect(logout()).resolves.toBeUndefined();

    expect(api.called('POST /auth/logout')).toHaveLength(2);
  });

  it('AT-S4: sends the body as JSON with a JSON content type', async () => {
    const api = mockApi({ 'POST /anything': json(200, {}) });

    await postJson('/anything', { a: 1 });

    expect(api.called('POST /anything')[0]?.body).toEqual({ a: 1 });
    const init = api.fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')?.[1];
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });
});

describe('API client: errors', () => {
  it('extra: a network failure becomes a NetworkError', async () => {
    mockApi({
      'GET /posts': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    await expect(getPosts()).rejects.toBeInstanceOf(NetworkError);
  });

  it('extra: an error response keeps its status, code, message and field errors', async () => {
    mockApi({
      'POST /auth/register': apiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', {
        username: ['Must be 3 to 30 characters.'],
      }),
    });

    await expect(postJson('/auth/register', {})).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid.',
      fields: { username: ['Must be 3 to 30 characters.'] },
    });
  });

  it('extra: an error with an unreadable body still becomes an ApiRequestError', async () => {
    const fetchMock = mockApi().fetchMock;
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(getPosts()).rejects.toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' });
  });
});
