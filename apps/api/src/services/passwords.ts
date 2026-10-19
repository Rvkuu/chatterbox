import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

// SEC5 in docs/security.md: Argon2id with memory 19456 KiB, time cost 2 and parallelism 1. The
// parameters are stored inside each hash, so they can be raised later and old hashes still verify.
// Tests use these same parameters. They are never weakened.
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface PasswordHasher {
  hash: (password: string) => Promise<string>;
  verify: (hash: string, password: string) => Promise<boolean>;
  // True when the stored hash was made with older parameters than the current ones.
  needsRehash: (hash: string) => boolean;
  // Does the same work as `verify` against a hash that matches nothing. Used when the email is
  // unknown, so that the work done does not reveal whether an account exists (FR-02.4).
  verifyDummy: (password: string) => Promise<void>;
}

export function createPasswordHasher(): PasswordHasher {
  // Created once at start-up from random data, with the same parameters as real hashes.
  const dummyHash = argon2.hash(randomBytes(32).toString('hex'), OPTIONS);
  dummyHash.catch(() => undefined);

  return {
    hash: (password) => argon2.hash(password, OPTIONS),
    verify: async (hash, password) => {
      try {
        return await argon2.verify(hash, password);
      } catch {
        // A malformed stored hash must never authenticate anyone.
        return false;
      }
    },
    needsRehash: (hash) => {
      try {
        return argon2.needsRehash(hash, OPTIONS);
      } catch {
        return false;
      }
    },
    verifyDummy: async (password) => {
      await argon2.verify(await dummyHash, password).catch(() => false);
    },
  };
}
