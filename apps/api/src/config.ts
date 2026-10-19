export type NodeEnv = 'development' | 'test' | 'production';

export interface Config {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  // The only origin allowed to send state-changing requests (docs/security.md section 6).
  webOrigin: string;
  cookieSecure: boolean;
}

const NODE_ENVS: readonly string[] = ['development', 'test', 'production'];
const MIN_PRODUCTION_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET = /replace-with|change-?me|placeholder|your-secret/i;

// Reads and validates configuration from environment variables. Throws one clear error that lists
// every problem instead of starting with a bad value. Messages never repeat a secret or a URL,
// because both can contain credentials (docs/security.md section 9).
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];

  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!NODE_ENVS.includes(nodeEnv)) {
    problems.push(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}.`);
  }

  const port = Number(env.API_PORT ?? '4000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push('API_PORT must be a whole number between 1 and 65535.');
  }

  const databaseUrl = env.DATABASE_URL ?? '';
  if (!isPostgresUrl(databaseUrl)) {
    problems.push('DATABASE_URL must be set to a postgresql:// connection string.');
  }

  const sessionSecret = env.SESSION_SECRET ?? '';
  if (sessionSecret === '') {
    problems.push('SESSION_SECRET must be set.');
  } else if (nodeEnv === 'production') {
    // SEC8: a forgotten placeholder is a common real-world failure.
    if (PLACEHOLDER_SECRET.test(sessionSecret)) {
      problems.push('SESSION_SECRET is still a placeholder. Generate a real one (see the README).');
    } else if (sessionSecret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      problems.push(`SESSION_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters.`);
    }
  }

  const webOrigin = env.WEB_ORIGIN ?? 'http://localhost:5173';
  if (!isOrigin(webOrigin)) {
    problems.push('WEB_ORIGIN must be an origin such as http://localhost:5173, with no path.');
  }

  const rawSecure = env.COOKIE_SECURE;
  if (rawSecure !== undefined && rawSecure !== 'true' && rawSecure !== 'false') {
    problems.push('COOKIE_SECURE must be true or false.');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n- ${problems.join('\n- ')}`);
  }

  return {
    nodeEnv: nodeEnv as NodeEnv,
    // Local development listens on this machine only. Docker sets API_HOST=0.0.0.0.
    host: env.API_HOST ?? '127.0.0.1',
    port,
    databaseUrl,
    sessionSecret,
    webOrigin,
    // Secure cookies need HTTPS. The local demo runs over HTTP, so this can be switched off
    // explicitly (docs/adr/0009). The default is on in production.
    cookieSecure: rawSecure === undefined ? nodeEnv === 'production' : rawSecure === 'true',
  };
}

function isPostgresUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'postgresql:' || protocol === 'postgres:';
  } catch {
    return false;
  }
}

function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}
