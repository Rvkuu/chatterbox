import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/globalSetup.ts'],
    // The integration tests share one test database, so the files run one after another.
    fileParallelism: false,
  },
});
