import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Settings come from the .env file in the repository root, the same one the API reads.
const envDir = '../..';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const apiPort = env.API_PORT ?? '4000';

  return {
    envDir,
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      // The browser only ever talks to this server. It forwards /api to the API (ADR-0006).
      proxy: { '/api': `http://127.0.0.1:${apiPort}` },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
