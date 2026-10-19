import { describe, expect, it } from 'vitest';
import { ApiError } from './errors.js';
import { loginSchema, parseBody, registerSchema } from './validation/schemas.js';
import { countCharacters } from './validation/text.js';

const valid = {
  email: 'ada@example.com',
  username: 'ada_l',
  password: 'correct horse battery staple',
};

function failure(body: unknown): ApiError {
  try {
    parseBody(registerSchema, body);
  } catch (err) {
    if (err instanceof ApiError) {
      return err;
    }
  }
  throw new Error('Expected a validation error');
}

describe('registration rules (unit)', () => {
  it('AT-R3: trims the email and lower-cases it', () => {
    const parsed = parseBody(registerSchema, { ...valid, email: '  Ada@Example.COM ' });
    expect(parsed.email).toBe('ada@example.com');
  });

  it('AT-R3: trims the username but keeps its capitals for display', () => {
    expect(parseBody(registerSchema, { ...valid, username: '  Ada_L ' }).username).toBe('Ada_L');
  });

  it('AT-R4: never trims or changes the password', () => {
    const password = '  spaces are part of this password  ';
    expect(parseBody(registerSchema, { ...valid, password }).password).toBe(password);
  });

  it.each([
    ['a missing email', { username: valid.username, password: valid.password }, 'email'],
    ['a wrong type for the username', { ...valid, username: 42 }, 'username'],
    ['an email with no @', { ...valid, email: 'ada.example.com' }, 'email'],
    [
      'an email over 254 characters',
      { ...valid, email: `${'a'.repeat(250)}@example.com` },
      'email',
    ],
    ['a 2 character username', { ...valid, username: 'ab' }, 'username'],
    ['a 31 character username', { ...valid, username: 'a'.repeat(31) }, 'username'],
    ['a username with a space', { ...valid, username: 'ada l' }, 'username'],
    ['a username with a hyphen', { ...valid, username: 'ada-l' }, 'username'],
    ['an 11 character password', { ...valid, password: 'x'.repeat(11) }, 'password'],
    ['a 129 character password', { ...valid, password: 'x'.repeat(129) }, 'password'],
    ['a password that is not text', { ...valid, password: ['a'] }, 'password'],
  ])('AT-R4: rejects %s with a message on that field', (_name, body, field) => {
    const err = failure(body);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fields?.[field]?.length).toBeGreaterThan(0);
  });

  it('AT-R4: accepts the boundaries (3 and 30 character usernames, 12 and 128 character passwords)', () => {
    expect(() => parseBody(registerSchema, { ...valid, username: 'abc' })).not.toThrow();
    expect(() => parseBody(registerSchema, { ...valid, username: 'a'.repeat(30) })).not.toThrow();
    expect(() => parseBody(registerSchema, { ...valid, password: 'x'.repeat(12) })).not.toThrow();
    expect(() => parseBody(registerSchema, { ...valid, password: 'x'.repeat(128) })).not.toThrow();
  });

  it('AT-R4: counts a password in characters, so 12 emoji are enough', () => {
    expect(() => parseBody(registerSchema, { ...valid, password: '🙂'.repeat(12) })).not.toThrow();
    expect(() => parseBody(registerSchema, { ...valid, password: '🙂'.repeat(11) })).toThrow();
  });

  it('AT-R4: reports every invalid field at once', () => {
    const err = failure({ email: 'nope', username: 'a', password: 'short' });
    expect(Object.keys(err.fields ?? {}).sort()).toEqual(['email', 'password', 'username']);
  });

  it('AT-R5: names an unknown field', () => {
    expect(failure({ ...valid, role: 'admin' }).fields).toEqual({ role: ['Unknown field.'] });
  });

  it('AT-R4: a body that is not an object gives a message about the body', () => {
    const err = failure(['not', 'an', 'object']);
    expect(err.message).toBe('The request body must be a JSON object.');
    expect(err.fields).toBeUndefined();
  });

  it('AT-R4: a missing body is reported as missing fields', () => {
    expect(Object.keys(failure(undefined).fields ?? {}).sort()).toEqual([
      'email',
      'password',
      'username',
    ]);
  });
});

describe('login rules (unit)', () => {
  it('AT-L4: needs an email and a password, and nothing else', () => {
    expect(() => parseBody(loginSchema, { email: 'a@b.co', password: 'x' })).not.toThrow();
    expect(() => parseBody(loginSchema, { email: 'a@b.co' })).toThrow();
    expect(() => parseBody(loginSchema, { email: 'a@b.co', password: 'x', extra: 1 })).toThrow();
  });

  it('AT-L4: does not reveal the password rules, so a short password is still well formed', () => {
    expect(() => parseBody(loginSchema, { email: 'a@b.co', password: 'short' })).not.toThrow();
  });
});

describe('character counting (unit)', () => {
  it('AT-P4: counts code points, so an emoji is one character', () => {
    expect(countCharacters('abc')).toBe(3);
    expect(countCharacters('🙂')).toBe(1);
    expect(countCharacters('🙂'.repeat(280))).toBe(280);
    expect('🙂'.length).toBe(2);
  });
});
