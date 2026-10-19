import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './generated/prisma/client.js';
import type { Logger } from './logger.js';

export type Db = PrismaClient;

// One connection pool is shared by Prisma and the session store.
export function createPool(databaseUrl: string): Pool {
  const pool = new Pool({ connectionString: databaseUrl });
  // An idle connection can fail when the database restarts. Without a listener that would crash
  // the process, and the pool replaces the connection by itself.
  pool.on('error', () => undefined);
  return pool;
}

export function createDb(pool: Pool): Db {
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const HEALTH_TIMEOUT_MS = 2000;

// True when a trivial query succeeds. Never throws and never exposes error text.
export async function isDatabaseUp(db: Db, timeoutMs = HEALTH_TIMEOUT_MS): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const query = db.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([query, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// NFR-R2: wait for the database instead of serving traffic or crashing while it starts.
export async function waitForDatabase(
  db: Db,
  logger: Logger,
  { attempts = 30, delayMs = 1000 } = {},
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (await isDatabaseUp(db)) {
      return true;
    }
    logger.info({ event: 'waiting-for-database', attempt, attempts });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}
