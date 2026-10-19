import { down, up } from './stack';

// Start from nothing: no containers and no volume, then build and start the stack.
export default function globalSetup(): void {
  down({ volumes: true });
  up();
}
