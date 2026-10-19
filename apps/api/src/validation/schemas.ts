import { z } from 'zod';
import { validationError } from '../errors.js';
import { countCharacters } from './text.js';

// Strict objects reject unknown fields, so a client cannot smuggle in fields such as `author`
// (docs/api.md section 1). Whitespace around email, username and content is trimmed before the
// rules run. Passwords are never trimmed or otherwise changed (docs/security.md section 4).

const text = (what: string) =>
  z.string({
    error: (issue) => (issue.input === undefined ? 'Required.' : `${what} must be text.`),
  });

// True when the text has between `min` and `max` characters.
const lengthBetween = (min: number, max: number) => (value: string) => {
  const length = countCharacters(value);
  return length >= min && length <= max;
};

export const registerSchema = z.strictObject({
  email: text('Email')
    .trim()
    .toLowerCase()
    .refine(lengthBetween(1, 254), 'Must be at most 254 characters.')
    .pipe(z.email({ error: 'Must be a valid email address.' })),
  username: text('Username')
    .trim()
    .refine(lengthBetween(3, 30), 'Must be 3 to 30 characters.')
    .regex(/^[A-Za-z0-9_]+$/, 'Use only letters, numbers and underscores.'),
  password: text('Password').refine(lengthBetween(12, 128), 'Must be 12 to 128 characters.'),
});

// Login checks the shape only. A short or wrong password is a normal failed login (401), so the
// password rules are not revealed here. The upper bound stops very long inputs reaching the hasher.
export const loginSchema = z.strictObject({
  email: text('Email')
    .trim()
    .toLowerCase()
    .refine(lengthBetween(1, 254), 'Must be at most 254 characters.'),
  password: text('Password').refine(lengthBetween(1, 128), 'Must be at most 128 characters.'),
});

export const createPostSchema = z.strictObject({
  content: text('Content').trim().refine(lengthBetween(1, 280), 'Must be 1 to 280 characters.'),
});

// Validates a request body and returns the cleaned value, or throws a VALIDATION_ERROR with a
// message per field (FR-01.6). A missing body is treated as an empty object, so the response names
// the missing fields.
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body ?? {});
  if (result.success) {
    return result.data;
  }

  const fields: Record<string, string[]> = {};
  let bodyIssue = false;
  const add = (field: string, message: string): void => {
    const messages = (fields[field] ??= []);
    if (!messages.includes(message)) {
      messages.push(message);
    }
  };

  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        add(key, 'Unknown field.');
      }
      continue;
    }
    const field = issue.path[0];
    if (typeof field === 'string') {
      add(field, issue.message);
    } else {
      bodyIssue = true;
    }
  }

  throw validationError(
    Object.keys(fields).length > 0 ? fields : undefined,
    bodyIssue ? 'The request body must be a JSON object.' : 'Some fields are invalid.',
  );
}
