import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../errors.js';
import type { Logger } from '../logger.js';

// Every error response uses the shape documented in docs/api.md section 2.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

function errorBody(code: string, message: string, fields?: Record<string, string[]>): ApiErrorBody {
  return { error: { code, message, ...(fields === undefined ? {} : { fields }) } };
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

// Connection failures from pg, Prisma and the session store. Codes: Node socket errors, Postgres
// classes 08 (connection) and 57P (shutdown), and Prisma's P1001, P1002 and P1017.
const UNAVAILABLE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']);
const UNAVAILABLE_PREFIXES = ['08', '57P'];
const PRISMA_UNAVAILABLE = new Set(['P1001', 'P1002', 'P1017']);

function isDatabaseUnavailable(err: unknown, depth = 0): boolean {
  if (typeof err !== 'object' || err === null || depth > 4) {
    return false;
  }
  if ('code' in err && typeof err.code === 'string') {
    const code = err.code;
    if (
      UNAVAILABLE_CODES.has(code) ||
      PRISMA_UNAVAILABLE.has(code) ||
      UNAVAILABLE_PREFIXES.some((prefix) => code.startsWith(prefix))
    ) {
      return true;
    }
  }
  return 'cause' in err && isDatabaseUnavailable(err.cause, depth + 1);
}

// Express recognises an error handler by its four parameters, so `_next` must stay.
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof ApiError) {
      res.status(err.status).json(errorBody(err.code, err.message, err.fields));
      return;
    }

    if (isDatabaseUnavailable(err)) {
      logger.error('Database unavailable', err);
      res
        .status(503)
        .json(errorBody('SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.'));
      return;
    }

    switch (errorType(err)) {
      case 'entity.parse.failed':
        res.status(400).json(errorBody('VALIDATION_ERROR', 'The request body is not valid JSON.'));
        return;
      case 'entity.too.large':
        res.status(400).json(errorBody('VALIDATION_ERROR', 'The request body is too large.'));
        return;
      case 'encoding.unsupported':
      case 'charset.unsupported':
        res.status(415).json(errorBody('UNSUPPORTED_MEDIA_TYPE', 'Unsupported encoding.'));
        return;
      default:
        // The details go to the server log only, never to the client (NFR-S4).
        logger.error('Unhandled error', err);
        res.status(500).json(errorBody('INTERNAL_ERROR', 'Something went wrong.'));
    }
  };
}
