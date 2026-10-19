import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from './middleware/errors.js';
import { captureLogs, createTestApp, type TestApp } from './test/helpers.js';

describe('app', () => {
  let t: TestApp;
  beforeAll(() => {
    t = createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('scaffold: an unknown route returns the documented 404 error shape', async () => {
    const res = await request(t.app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  it('scaffold: malformed JSON returns 400 VALIDATION_ERROR', async () => {
    const res = await request(t.app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'The request body is not valid JSON.' },
    });
  });

  it('scaffold: a body over 10 KB returns 400 VALIDATION_ERROR', async () => {
    const res = await request(t.app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(11 * 1024) }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'The request body is too large.' },
    });
  });

  it('extra: sends the security headers from docs/security.md section 10', async () => {
    const res = await request(t.app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
  });

  it('extra: every response carries a request ID that appears in the log', async () => {
    const res = await request(t.app).get('/api/health');
    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.logs.text()).toContain(id);
    expect(t.logs.text()).toContain('"path":"/api/health"');
  });
});

describe('errorHandler', () => {
  it('SEC-T11: an unexpected error gives a generic 500 with no internal details', async () => {
    const logs = captureLogs();
    const broken = express();
    broken.get('/boom', () => {
      throw new Error('internal detail that must never reach the client');
    });
    broken.use(createErrorHandler(logs.logger));

    const res = await request(broken).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
    });
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
    expect(res.text).not.toContain('at ');
    // The detail is kept for the server log, which is where it belongs.
    expect(logs.text()).toContain('internal detail');
  });

  it('extra: a database connection failure maps to 503 SERVICE_UNAVAILABLE', async () => {
    const logs = captureLogs();
    const broken = express();
    broken.get('/down', () => {
      throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), {
        code: 'ECONNREFUSED',
      });
    });
    broken.use(createErrorHandler(logs.logger));

    const res = await request(broken).get('/down');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable.' },
    });
    expect(res.text).not.toContain('10.0.0.5');
    vi.restoreAllMocks();
  });
});
