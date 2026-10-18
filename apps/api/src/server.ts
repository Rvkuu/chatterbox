import { createApp } from './app.js';
import { loadConfig } from './config.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const server = createApp().listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}`);
});

// Docker stops containers with SIGTERM. Finish open requests, then exit.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down.`);
  server.close((err) => process.exit(err ? 1 : 0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
