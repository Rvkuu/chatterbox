import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from './test/helpers.js';

describe('GET /api/health', () => {
  it('AT-D7: reports ok and database up when PostgreSQL is reachable', async () => {
    const t = createTestApp();
    try {
      const res = await request(t.app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', database: 'up' });
    } finally {
      await t.close();
    }
  });

  describe('with the database unreachable', () => {
    // Nothing listens on port 1, so every connection is refused.
    const down = createTestApp({
      DATABASE_URL: 'postgresql://nobody:secret-pw@127.0.0.1:1/nothing',
    });
    afterAll(async () => {
      await down.close();
    });

    it('AT-D7: reports 503 degraded and database down, without connection details', async () => {
      const res = await request(down.app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'degraded', database: 'down' });
      expect(res.text).not.toMatch(/postgres|127\.0\.0\.1|secret-pw|nobody|ECONN|version/i);
    });

    it('extra: a request that needs the database returns 503 SERVICE_UNAVAILABLE', async () => {
      // Creating the session needs the database, so the request fails with 503 and not a 500.
      const res = await request(down.app).get('/api/csrf-token');
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
});
