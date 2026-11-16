'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./configs/env');
const { createApp } = require('./app');
const { closePool } = require('./configs/db');

fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });

const app = createApp();
const server = app.listen(config.port, () => {
  console.log('Book Borrowing System listening on port %d', config.port);
  console.log('Host: %s (%s %s), CPUs: %d, total memory: %d MB', os.hostname(), os.platform(), os.arch(), os.cpus().length, Math.round(os.totalmem() / 1024 / 1024));
  console.log('Environment: %s', config.nodeEnv);
});

let shuttingDown = false;

async function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Shutting down (%s)...', reason);

  const forceExit = setTimeout(() => {
    console.error('Forced shutdown after 10s');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  server.close(async () => {
    try {
      await closePool();
    } catch (err) {
      console.error('Error closing the database pool:', err.message);
    }
    process.exit(exitCode);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  shutdown('unhandledRejection', 1);
});

module.exports = { server };
