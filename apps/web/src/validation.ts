// The same rules as the server (docs/requirements.md D1 to D4), checked early so the user gets
// instant feedback. The server stays the authority: it validates everything again.

export type Errors<K extends string> = Partial<Record<K, string>>;

// Length in characters, so that an emoji counts as one (DB4 in docs/database.md).
export function countCharacters(value: string): number {
  return [...value].length;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[A-Za-z0-9_]+$/;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (email === '') return 'Enter your email address.';
  if (countCharacters(email) > 254) return 'Must be at most 254 characters.';
  if (!EMAIL.test(email)) return 'Must be a valid email address.';
  return undefined;
}

export function validateUsername(value: string): string | undefined {
  const username = value.trim();
  const length = countCharacters(username);
  if (length < 3 || length > 30) return 'Must be 3 to 30 characters.';
  if (!USERNAME.test(username)) return 'Use only letters, numbers and underscores.';
  return undefined;
}

export function validateNewPassword(value: string): string | undefined {
  const length = countCharacters(value);
  if (length < 12 || length > 128) return 'Must be 12 to 128 characters.';
  return undefined;
}

export function validatePostContent(value: string): string | undefined {
  const length = countCharacters(value.trim());
  if (length < 1) return 'Write something first.';
  if (length > 280) return 'Must be at most 280 characters.';
  return undefined;
}
