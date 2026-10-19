import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const apiDir = resolve(import.meta.dirname, '../..');

// Runs `prisma migrate deploy` against the given database and returns its output.
//
// It starts the Prisma CLI with Node itself instead of going through `npx`. On Windows `npx` is a
// `.cmd` file, which `execFileSync` cannot start (error ENOENT), so this way works on every system.
export function migrateDeploy(databaseUrl: string): string {
  const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
  return execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    stdio: 'pipe',
  });
}
