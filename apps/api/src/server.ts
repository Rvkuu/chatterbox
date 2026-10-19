import { createApp } from './app.js';
import { loadConfig, type Config } from './config.js';
import { createDb, createPool, waitForDatabase } from './db.js';
import { consoleLogger } from './logger.js';

let config: Config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const pool = createPool(config.databaseUrl);
const db = createDb(pool);

// NFR-R2: do not serve traffic until the database answers.
if (!(await waitForDatabase(db, consoleLogger))) {
  console.error('The database did not become reachable. Exiting.');
  process.exit(1);
}

const server = createApp({ config, db, pool }).listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}`);
});

// Docker stops containers with SIGTERM. Finish open requests, close the database, then exit.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down.`);
  server.close((err) => {
    void db.$disconnect().finally(() => process.exit(err ? 1 : 0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
