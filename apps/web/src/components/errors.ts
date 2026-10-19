import { ApiRequestError, NetworkError } from '../api/client';
import type { FieldErrors } from '../api/client';

// What to tell the user when a request fails and the problem is not tied to one field.
export function generalMessage(err: unknown): string {
  if (err instanceof NetworkError) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (err instanceof ApiRequestError) {
    if (err.status === 503) return 'The service is temporarily unavailable. Please try again.';
    if (err.status >= 500) return 'Something went wrong. Please try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

export function firstMessage(fields: FieldErrors | undefined, field: string): string | undefined {
  return fields?.[field]?.[0];
}
