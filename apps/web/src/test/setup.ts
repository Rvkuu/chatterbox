import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// With Vitest's globals switched off, Testing Library cannot clean up by itself.
afterEach(() => {
  cleanup();
});
