import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase, testDatabaseUrl, type TestApp } from './test/helpers.js';

const apiDir = resolve(import.meta.dirname, '..');

function deployMigrations(): string {
  return execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    encoding: 'utf8',
  });
}

describe('database schema', () => {
  let t: TestApp;
  beforeAll(() => {
    t = createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.db);
  });

  it('AT-D1: migrations build the tables, indexes and constraints from docs/database.md', async () => {
    const tables = await t.db.$queryRaw<{ name: string }[]>`
      SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users', 'posts', 'session')`;
    expect(tables.map((row) => row.name).sort()).toEqual(['posts', 'session', 'users']);

    const indexes = await t.db.$queryRaw<{ name: string; def: string }[]>`
      SELECT indexname AS name, indexdef AS def FROM pg_indexes WHERE schemaname = 'public'`;
    const byName = new Map(indexes.map((row) => [row.name, row.def]));
    expect(byName.get('users_email_key')).toContain('UNIQUE');
    expect(byName.get('users_usernameKey_key')).toContain('UNIQUE');
    expect(byName.get('posts_feed_idx')).toContain('"createdAt" DESC, id DESC');
    expect(byName.has('posts_authorId_idx')).toBe(true);
    expect(byName.has('session_expire_idx')).toBe(true);

    const checks = await t.db.$queryRaw<{ name: string }[]>`
      SELECT conname AS name FROM pg_constraint WHERE contype = 'c'`;
    expect(checks.map((row) => row.name)).toContain('posts_content_not_blank');

    // DB5: deleting a user who has posts is blocked.
    const rules = await t.db.$queryRaw<{ rule: string }[]>`
      SELECT delete_rule AS rule FROM information_schema.referential_constraints
      WHERE constraint_name = 'posts_authorId_fkey'`;
    expect(rules).toEqual([{ rule: 'RESTRICT' }]);
  });

  it('AT-D2: deploying the migrations again changes nothing and does not fail', () => {
    expect(deployMigrations()).toContain('No pending migrations to apply');
    expect(deployMigrations()).toContain('No pending migrations to apply');
  });

  describe('the database enforces its own rules (AT-D3)', () => {
    async function insertUser(email: string, key: string): Promise<string> {
      const rows = await t.db.$queryRaw<{ id: string }[]>`
        INSERT INTO users (email, username, "usernameKey", "passwordHash")
        VALUES (${email}, ${key}, ${key}, 'x') RETURNING id::text`;
      return rows[0]?.id ?? '';
    }

    it('AT-D3: rejects a duplicate email', async () => {
      await insertUser('ada@example.com', 'ada_l');
      await expect(insertUser('ada@example.com', 'someone_else')).rejects.toThrow();
    });

    it('AT-D3: rejects a duplicate usernameKey', async () => {
      await insertUser('ada@example.com', 'ada_l');
      await expect(insertUser('other@example.com', 'ada_l')).rejects.toThrow();
    });

    it('AT-D3: rejects whitespace-only post content', async () => {
      const id = await insertUser('ada@example.com', 'ada_l');
      await expect(
        t.db.$executeRaw`INSERT INTO posts ("authorId", content) VALUES (${id}::uuid, '   ')`,
      ).rejects.toThrow();
    });

    it('AT-D3: rejects a post whose author does not exist', async () => {
      const missing = '00000000-0000-4000-8000-000000000000';
      await expect(
        t.db
          .$executeRaw`INSERT INTO posts ("authorId", content) VALUES (${missing}::uuid, 'hello')`,
      ).rejects.toThrow();
    });

    it('AT-D3: rejects deleting a user who has posts', async () => {
      const id = await insertUser('ada@example.com', 'ada_l');
      await t.db.$executeRaw`INSERT INTO posts ("authorId", content) VALUES (${id}::uuid, 'hello')`;
      await expect(t.db.$executeRaw`DELETE FROM users WHERE id = ${id}::uuid`).rejects.toThrow();
    });

    it('AT-D3: rejects content over 280 characters', async () => {
      const id = await insertUser('ada@example.com', 'ada_l');
      const long = 'x'.repeat(281);
      await expect(
        t.db.$executeRaw`INSERT INTO posts ("authorId", content) VALUES (${id}::uuid, ${long})`,
      ).rejects.toThrow();
    });
  });
});
