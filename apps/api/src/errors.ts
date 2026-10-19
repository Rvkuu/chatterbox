// An error that is safe to show to the client. The central handler turns it into the response
// shape documented in docs/api.md section 2. Anything else becomes a generic 500.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthenticated = (): ApiError =>
  new ApiError(401, 'UNAUTHENTICATED', 'You need to log in.');

export const invalidCredentials = (): ApiError =>
  new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

export const csrfInvalid = (): ApiError =>
  new ApiError(403, 'CSRF_INVALID', 'The request could not be verified. Please try again.');

export const unsupportedMediaType = (): ApiError =>
  new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'The request body must be application/json.');

export const validationError = (
  fields?: Record<string, string[]>,
  message = 'Some fields are invalid.',
): ApiError => new ApiError(400, 'VALIDATION_ERROR', message, fields);

export const conflict = (fields: Record<string, string[]>): ApiError =>
  new ApiError(409, 'CONFLICT', 'Could not create the account.', fields);
