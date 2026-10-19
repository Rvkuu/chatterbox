import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrateDeploy } from './prisma.js';

const apiDir = resolve(import.meta.dirname, '../..');

// Runs once before the test files. Builds the test database from the real migrations, so the tests
// check the same schema that production gets (AT-D1). The database comes from the environment and
// is never a developer's own data (NFR-T2).
export function setup(): void {
  const envFile = resolve(apiDir, '../../.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const url = process.env.TEST_DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'TEST_DATABASE_URL is not set. Start the database and set it (see "Running the tests" in the README).',
    );
  }
  // A safety net: tests empty their tables, so they may only ever run against a *_test database.
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must name a database that ends in "_test".');
  }

  try {
    migrateDeploy(url);
  } catch (err) {
    // Say what is wrong in plain words. The connection string is not printed, because it contains
    // the password.
    const { hostname, port } = new URL(url);
    const stderr = (err as { stderr?: string }).stderr ?? '';
    const reason = stderr.includes('P1001')
      ? `PostgreSQL did not answer at ${hostname}:${port}. Is it running? Start it with "npm run db:up" (see "Running the tests" in the README).`
      : `The migrations could not be applied to the test database at ${hostname}:${port}: ${(
          stderr.trim() || (err instanceof Error ? err.message : String(err))
        )
          .split('\n')
          .slice(-3)
          .join(' ')}`;
    throw new Error(reason, { cause: err });
  }
}
