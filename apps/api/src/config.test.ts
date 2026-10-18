import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('scaffold: uses safe defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({ nodeEnv: 'development', host: '127.0.0.1', port: 4000 });
  });

  it('scaffold: reads values from the environment', () => {
    const config = loadConfig({ NODE_ENV: 'production', API_HOST: '0.0.0.0', API_PORT: '8080' });
    expect(config).toEqual({ nodeEnv: 'production', host: '0.0.0.0', port: 8080 });
  });

  it.each(['abc', '0', '70000', '12.5', ''])('scaffold: rejects API_PORT=%j', (port) => {
    expect(() => loadConfig({ API_PORT: port })).toThrow('API_PORT');
  });

  it('scaffold: rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig({ NODE_ENV: 'staging' })).toThrow('NODE_ENV');
  });
});
