export type NodeEnv = 'development' | 'test' | 'production';

export interface Config {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
}

const NODE_ENVS: readonly string[] = ['development', 'test', 'production'];

// Reads and validates configuration from environment variables. Throws a clear error
// instead of starting with a bad value.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!NODE_ENVS.includes(nodeEnv)) {
    throw new Error(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}.`);
  }

  const rawPort = env.API_PORT ?? '4000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be a whole number between 1 and 65535.');
  }

  return {
    nodeEnv: nodeEnv as NodeEnv,
    // Local development listens on this machine only. Docker sets API_HOST=0.0.0.0.
    host: env.API_HOST ?? '127.0.0.1',
    port,
  };
}
