import { apiBaseUrl } from '../config';

// The only code that calls fetch (docs/architecture.md section 6). It adds the CSRF token to every
// POST, fetches a new one once when the server rejects it, and turns failures into typed errors.

export type FieldErrors = Record<string, string[]>;

// The server answered with an error in the documented format (docs/api.md section 2).
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// The request never got an answer: the server is down or the network failed.
export class NetworkError extends Error {
  constructor() {
    super('Could not reach the server.');
    this.name = 'NetworkError';
  }
}

let csrfToken: string | undefined;
let tokenRequest: Promise<string> | undefined;

// The token belongs to a session. When the session changes (login, logout) the old token is
// useless, so the next POST fetches a fresh one (AT-S4).
export function resetCsrfToken(): void {
  csrfToken = undefined;
  tokenRequest = undefined;
}

async function send(method: string, path: string, body?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrfToken ?? '';
  }
  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      ...(body === undefined ? {} : { body }),
    });
  } catch {
    throw new NetworkError();
  }
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (text === '') {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toError(res: Response, data: unknown): ApiRequestError {
  const error = (
    data as { error?: { code?: string; message?: string; fields?: FieldErrors } } | undefined
  )?.error;
  return new ApiRequestError(
    res.status,
    error?.code ?? 'UNKNOWN_ERROR',
    error?.message ?? 'Something went wrong.',
    error?.fields,
  );
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await send('GET', path);
  const data = await readBody(res);
  if (!res.ok) {
    throw toError(res, data);
  }
  return data as T;
}

function loadCsrfToken(): Promise<string> {
  tokenRequest ??= getJson<{ csrfToken: string }>('/csrf-token').then(
    (body) => {
      csrfToken = body.csrfToken;
      return body.csrfToken;
    },
    (err: unknown) => {
      tokenRequest = undefined;
      throw err;
    },
  );
  return tokenRequest;
}

export async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  // At most two attempts: if the first is rejected for its token (for example because the session
  // expired), get a new token and try once more. A second rejection is shown to the user.
  for (let attempt = 0; ; attempt++) {
    await loadCsrfToken();
    const res = await send('POST', path, JSON.stringify(body));
    const data = await readBody(res);
    if (res.ok) {
      return data as T;
    }
    const error = toError(res, data);
    if (error.code === 'CSRF_INVALID' && attempt === 0) {
      resetCsrfToken();
      continue;
    }
    throw error;
  }
}
