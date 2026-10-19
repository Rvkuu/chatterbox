import type { Express } from 'express';
import { loadConfig, type Config } from '../config.js';
import { createDb, createPool, type Db } from '../db.js';
import { createApp } from '../app.js';
import type { Logger } from '../logger.js';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (url === undefined) {
    throw new Error('TEST_DATABASE_URL is not set.');
  }
  return url;
}

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    SESSION_SECRET: 'test-only-secret-that-is-not-used-anywhere-else',
    WEB_ORIGIN: 'http://localhost:5173',
    COOKIE_SECURE: 'false',
    ...overrides,
  });
}

export interface LogCapture {
  logger: Logger;
  text(): string;
}

// Collects everything the app logs, so tests can check that no secret ends up there (AT-S5).
export function captureLogs(): LogCapture {
  const lines: string[] = [];
  return {
    logger: {
      info: (entry) => lines.push(JSON.stringify(entry)),
      error: (message, err) => lines.push(`${message} ${err instanceof Error ? err.stack : ''}`),
    },
    text: () => lines.join('\n'),
  };
}

export interface TestApp {
  app: Express;
  db: Db;
  logs: LogCapture;
  close(): Promise<void>;
}

// A fresh app with its own connection pool. Creating a second one models an API restart.
export function createTestApp(overrides: Record<string, string> = {}): TestApp {
  const config = testConfig(overrides);
  const pool = createPool(config.databaseUrl);
  const db = createDb(pool);
  const logs = captureLogs();
  const app = createApp({ config, db, pool, logger: logs.logger });
  return {
    app,
    db,
    logs,
    close: async () => {
      await db.$disconnect();
      await pool.end().catch(() => undefined);
    },
  };
}

// Every test starts from empty tables, and never depends on the order tests run in.
export async function resetDatabase(db: Db): Promise<void> {
  await db.$executeRaw`TRUNCATE TABLE "posts", "users", "session" RESTART IDENTITY CASCADE`;
}
