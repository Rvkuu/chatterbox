// Request logging records the method, path, status and duration with a request ID, and never a
// body, cookie, token or connection string (docs/security.md section 8).
export interface Logger {
  info(entry: Record<string, unknown>): void;
  error(message: string, err: unknown): void;
}

export const consoleLogger: Logger = {
  info: (entry) => console.log(JSON.stringify(entry)),
  // The stack trace goes to the server log only, never to the client.
  error: (message, err) => console.error(message, err instanceof Error ? err.stack : err),
};
