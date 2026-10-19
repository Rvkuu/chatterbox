import type { Db } from '../db.js';
import { conflict, invalidCredentials } from '../errors.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PasswordHasher } from './passwords.js';

// The only shape of a user that ever leaves the API (docs/api.md section 3). It is built field by
// field, never by spreading a database row, so email and password data cannot leak by accident
// (FR-01.5).
export interface PublicUser {
  id: string;
  username: string;
  createdAt: string;
}

export function toPublicUser(user: { id: string; username: string; createdAt: Date }): PublicUser {
  return { id: user.id, username: user.username, createdAt: user.createdAt.toISOString() };
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface AuthService {
  register: (input: RegisterInput) => Promise<PublicUser>;
  login: (email: string, password: string) => Promise<PublicUser>;
  findUser: (id: string) => Promise<PublicUser | null>;
}

// Postgres reports a duplicate as error code 23505, which Prisma maps to P2002.
function isUniqueViolation(err: unknown, depth = 0): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return true;
  }
  if (typeof err !== 'object' || err === null || depth > 4) {
    return false;
  }
  if ('code' in err && err.code === '23505') {
    return true;
  }
  return 'cause' in err && isUniqueViolation(err.cause, depth + 1);
}

export function createAuthService(db: Db, hasher: PasswordHasher): AuthService {
  // Names which field clashed, for the 409 response. This runs only after the database has already
  // rejected the insert, so a race between two registrations still ends in a 409, never a 500.
  async function conflictingFields(
    email: string,
    usernameKey: string,
  ): Promise<Record<string, string[]>> {
    const rows = await db.user.findMany({
      where: { OR: [{ email }, { usernameKey }] },
      select: { email: true, usernameKey: true },
    });
    const fields: Record<string, string[]> = {};
    if (rows.some((row) => row.email === email)) {
      fields.email = ['Already registered.'];
    }
    if (rows.some((row) => row.usernameKey === usernameKey)) {
      fields.username = ['Already taken.'];
    }
    return Object.keys(fields).length > 0 ? fields : { email: ['Already registered.'] };
  }

  return {
    async register({ email, username, password }) {
      const usernameKey = username.toLowerCase();
      const passwordHash = await hasher.hash(password);
      try {
        const user = await db.user.create({
          data: { email, username, usernameKey, passwordHash },
        });
        return toPublicUser(user);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw conflict(await conflictingFields(email, usernameKey));
        }
        throw err;
      }
    },

    async login(email, password) {
      const user = await db.user.findUnique({ where: { email } });
      if (user === null) {
        // Same amount of hashing work as for a wrong password (FR-02.4, SEC-T4).
        await hasher.verifyDummy(password);
        throw invalidCredentials();
      }
      if (!(await hasher.verify(user.passwordHash, password))) {
        throw invalidCredentials();
      }
      // The password is correct, so this is the moment to upgrade an older hash (security.md section 4).
      if (hasher.needsRehash(user.passwordHash)) {
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: await hasher.hash(password) },
        });
      }
      return toPublicUser(user);
    },

    async findUser(id) {
      const user = await db.user.findUnique({ where: { id } });
      return user === null ? null : toPublicUser(user);
    },
  };
}
