import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { errorHandler } from './middleware/errors.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('app', () => {
  const app = createApp();

  it('scaffold: GET /api/health returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('scaffold: an unknown route returns the documented 404 error shape', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  it('scaffold: malformed JSON returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'The request body is not valid JSON.' },
    });
  });

  it('scaffold: a body over 10 KB returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(11 * 1024) }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'The request body is too large.' },
    });
  });

  it('scaffold: does not advertise the framework in a header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('errorHandler', () => {
  it('scaffold: an unexpected error gives a generic 500 with no internal details', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = express();
    broken.get('/boom', () => {
      throw new Error('internal detail that must never reach the client');
    });
    broken.use(errorHandler);

    const res = await request(broken).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
    });
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
    expect(res.text).not.toContain('at ');
    expect(logged).toHaveBeenCalledOnce();
  });
});
