import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const DB = 'postgresql://user:pw@localhost:5432/db';
const GOOD_SECRET = 'a'.repeat(40);

// The smallest environment that loads in any mode.
function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { DATABASE_URL: DB, SESSION_SECRET: 'dev-secret', ...extra };
}

describe('loadConfig', () => {
  it('scaffold: uses safe defaults when only the required values are set', () => {
    expect(loadConfig(env())).toEqual({
      nodeEnv: 'development',
      host: '127.0.0.1',
      port: 4000,
      databaseUrl: DB,
      sessionSecret: 'dev-secret',
      webOrigin: 'http://localhost:5173',
      cookieSecure: false,
    });
  });

  it('scaffold: reads values from the environment', () => {
    const config = loadConfig(
      env({
        NODE_ENV: 'production',
        SESSION_SECRET: GOOD_SECRET,
        API_HOST: '0.0.0.0',
        API_PORT: '8080',
        WEB_ORIGIN: 'http://localhost:8080',
      }),
    );
    expect(config).toMatchObject({ nodeEnv: 'production', host: '0.0.0.0', port: 8080 });
    expect(config.webOrigin).toBe('http://localhost:8080');
  });

  it.each(['abc', '0', '70000', '12.5', ''])('scaffold: rejects API_PORT=%j', (port) => {
    expect(() => loadConfig(env({ API_PORT: port }))).toThrow('API_PORT');
  });

  it('scaffold: rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig(env({ NODE_ENV: 'staging' }))).toThrow('NODE_ENV');
  });

  it('extra: DATABASE_URL and SESSION_SECRET are required', () => {
    expect(() => loadConfig({ SESSION_SECRET: 'x' })).toThrow('DATABASE_URL');
    expect(() => loadConfig({ DATABASE_URL: DB })).toThrow('SESSION_SECRET');
    expect(() => loadConfig(env({ DATABASE_URL: 'mysql://localhost/db' }))).toThrow('DATABASE_URL');
  });

  it('extra: reports every problem at once', () => {
    expect(() => loadConfig({ API_PORT: 'x', NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV[\s\S]*API_PORT[\s\S]*DATABASE_URL[\s\S]*SESSION_SECRET/,
    );
  });

  it('extra: WEB_ORIGIN must be an origin, not a URL with a path', () => {
    expect(() => loadConfig(env({ WEB_ORIGIN: 'http://localhost:5173/' }))).toThrow('WEB_ORIGIN');
    expect(() => loadConfig(env({ WEB_ORIGIN: 'localhost' }))).toThrow('WEB_ORIGIN');
  });

  it('extra: COOKIE_SECURE defaults to on in production and can be set explicitly', () => {
    const prod = { NODE_ENV: 'production', SESSION_SECRET: GOOD_SECRET };
    expect(loadConfig(env(prod)).cookieSecure).toBe(true);
    expect(loadConfig(env({ ...prod, COOKIE_SECURE: 'false' })).cookieSecure).toBe(false);
    expect(loadConfig(env({ COOKIE_SECURE: 'true' })).cookieSecure).toBe(true);
    expect(() => loadConfig(env({ COOKIE_SECURE: 'yes' }))).toThrow('COOKIE_SECURE');
  });
});

describe('production secret check', () => {
  const production = { NODE_ENV: 'production' };

  it.each([
    ['is missing', undefined, 'SESSION_SECRET must be set'],
    ['is a placeholder', 'replace-with-a-long-random-string-0123456789', 'placeholder'],
    ['is another placeholder', 'change-me-0123456789012345678901234567', 'placeholder'],
    ['is too short', 'only-twenty-characters', 'at least 32'],
  ])('SEC-T12: refuses to start in production when SESSION_SECRET %s', (_name, secret, message) => {
    const environment = env(production);
    if (secret === undefined) {
      delete environment.SESSION_SECRET;
    } else {
      environment.SESSION_SECRET = secret;
    }
    expect(() => loadConfig(environment)).toThrow(message);
  });

  it('SEC-T12: starts in production with a real secret', () => {
    expect(() => loadConfig(env({ ...production, SESSION_SECRET: GOOD_SECRET }))).not.toThrow();
  });

  it('extra: error messages never repeat the secret or the database URL', () => {
    const secret = 'replace-with-a-long-random-string-0123456789';
    let message = '';
    try {
      loadConfig({ ...env(production), SESSION_SECRET: secret, API_PORT: 'bad' });
    } catch (err) {
      message = err instanceof Error ? err.message : '';
    }
    expect(message).not.toBe('');
    expect(message).not.toContain(secret);
    expect(message).not.toContain('user:pw');
  });
});
