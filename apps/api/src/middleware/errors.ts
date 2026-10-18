import type { ErrorRequestHandler, RequestHandler } from 'express';

// Every error response uses the shape documented in docs/api.md section 2.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(errorBody('NOT_FOUND', 'Not found.'));
};

// body-parser marks its own failures with a `type` property.
function errorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

// Express recognises an error handler by its four parameters, so `_next` must stay.
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  switch (errorType(err)) {
    case 'entity.parse.failed':
      res.status(400).json(errorBody('VALIDATION_ERROR', 'The request body is not valid JSON.'));
      return;
    case 'entity.too.large':
      res.status(400).json(errorBody('VALIDATION_ERROR', 'The request body is too large.'));
      return;
    default:
      // The details go to the server log only, never to the client.
      console.error('Unhandled error:', err);
      res.status(500).json(errorBody('INTERNAL_ERROR', 'Something went wrong.'));
  }
};
