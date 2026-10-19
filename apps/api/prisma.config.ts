import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Local development keeps its settings in the .env file at the repository root.
// Docker and CI set real environment variables, which take priority.
const envFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` needs no database, so a missing URL is fine until a command connects.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
