import { down } from './stack';

// Remove the test stack and its volume. Set E2E_KEEP_STACK=1 to leave it running for inspection.
export default function globalTeardown(): void {
  if (!process.env.E2E_KEEP_STACK) {
    down({ volumes: true });
  }
}
