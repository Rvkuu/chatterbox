import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Controls the Docker stack the tests run against. It is private to the tests: its own Compose
// project name and therefore its own network and database volume, its own port, and its own
// settings, so it can never touch a developer's stack or data (docs/acceptance-tests.md section 3).

const repoRoot = resolve(import.meta.dirname, '../../..');

export const PROJECT = 'chatterbox-e2e';
export const WEB_PORT = process.env.E2E_WEB_PORT ?? '18080';
export const BASE_URL = `http://localhost:${WEB_PORT}`;

const DB_USER = 'e2e';
const DB_NAME = 'chatterbox_e2e';

// The settings for the test stack. They live in a temporary file, not in the developer's .env,
// which Compose is told to ignore. The secret is generated once and reused by every process.
function envFile(): string {
  const path = join(tmpdir(), `${PROJECT}.env`);
  if (!existsSync(path)) {
    writeFileSync(
      path,
      [
        `POSTGRES_USER=${DB_USER}`,
        'POSTGRES_PASSWORD=e2e-only-password',
        `POSTGRES_DB=${DB_NAME}`,
        `SESSION_SECRET=${randomBytes(32).toString('hex')}`,
        `WEB_PORT=${WEB_PORT}`,
        'COOKIE_SECURE=false',
        '',
      ].join('\n'),
    );
  }
  return path;
}

function composeArgs(): string[] {
  const args = ['compose', '-p', PROJECT, '--env-file', envFile(), '-f', 'docker-compose.yml'];
  // Optional extra Compose file, for environments that need an adjustment (for example a proxy).
  if (process.env.E2E_COMPOSE_FILE_EXTRA) {
    args.push('-f', process.env.E2E_COMPOSE_FILE_EXTRA);
  }
  return args;
}

export function compose(...args: string[]): string {
  try {
    return execFileSync('docker', [...composeArgs(), ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 600_000,
    });
  } catch (err) {
    const detail = err as { stderr?: string; stdout?: string; message: string };
    throw new Error(
      `docker compose ${args.join(' ')} failed:\n${detail.stderr ?? ''}${detail.stdout ?? detail.message}`,
      { cause: err },
    );
  }
}

// Build the images if needed and start all three services, waiting until they are healthy.
export function up(): void {
  compose('up', '-d', '--build', '--wait');
}

// Remove the containers. With `volumes` the database volume goes too, and all data with it.
export function down({ volumes }: { volumes: boolean }): void {
  compose('down', ...(volumes ? ['-v'] : []));
}

// `docker compose restart`: the containers restart and the volume stays.
export function restartAll(): void {
  compose('restart');
  compose('up', '-d', '--wait');
}

export function restartService(service: 'api' | 'db' | 'web'): void {
  compose('restart', service);
  compose('up', '-d', '--wait');
}

export function stopService(service: 'api' | 'db' | 'web'): void {
  compose('stop', service);
}

export function startService(service: 'api' | 'db' | 'web'): void {
  compose('start', service);
  compose('up', '-d', '--wait');
}

// Runs SQL in the test database and returns the raw output.
export function sql(statement: string): string {
  return compose(
    'exec',
    '-T',
    'db',
    'psql',
    '-U',
    DB_USER,
    '-d',
    DB_NAME,
    '-tAc',
    statement,
  ).trim();
}

// Empties the tables, so a test starts from known state without rebuilding anything.
export function resetData(): void {
  sql('TRUNCATE posts, users, session CASCADE');
}

// How many times Docker had to restart a container because it crashed (not counting `restart`).
export function crashRestarts(service: 'api' | 'db' | 'web'): number {
  const id = compose('ps', '-q', service).trim();
  const out = execFileSync('docker', ['inspect', '--format', '{{.RestartCount}}', id], {
    encoding: 'utf8',
  });
  return Number(out.trim());
}
