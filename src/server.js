'use strict';

require('dotenv').config();

const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectDB } = require('./loaders/db');
const { getRedisClient } = require('./loaders/redis');
const { initSocket } = require('./sockets/index');
const { setIO } = require('./jobs/index');

// ── Create HTTP server (needed for Socket.IO) ─────────────────────────────────
const httpServer = http.createServer(app);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`Received ${signal} – shutting down gracefully`);
  httpServer.close(async () => {
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      await getRedisClient().quit();
      logger.info('All connections closed. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { err });
      process.exit(1);
    }
  });

  // Force kill after 30s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ── Unhandled promise rejections ──────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { err });
  process.exit(1);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Ping Redis
    await getRedisClient().ping();
    logger.info('✅  Redis ping OK');

    // 3. Attach Socket.IO
    const io = initSocket(httpServer);

    // 4. Give BullMQ workers access to Socket.IO
    setIO(io);

    // 5. Start scheduled cron jobs
    const { startCronJobs } = require('./jobs/cron');
    startCronJobs();

    // 5. Start listening
    httpServer.listen(config.port, () => {
      logger.info(`🚀  Server running on port ${config.port} [${config.env}]`);
      logger.info(`📡  API available at /api/${config.apiVersion}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { err });
    process.exit(1);
  }
})();
