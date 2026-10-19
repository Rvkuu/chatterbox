import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetCsrfToken } from '../api/client';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // The client keeps the CSRF token in memory, so every test starts without one.
  resetCsrfToken();
});
