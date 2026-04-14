'use strict';

const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB with retry logic.
 */
async function connectDB() {
  const MAX_RETRIES = 5;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(config.mongo.uri, config.mongo.options);
      logger.info('✅  MongoDB connected');

      // ── Connection event listeners ─────────────────────────────────────────
      mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
      mongoose.connection.on('error', (err) => logger.error('MongoDB error', { err }));
      return;
    } catch (err) {
      retries++;
      logger.error(`MongoDB connection failed (attempt ${retries}/${MAX_RETRIES})`, { err });
      if (retries === MAX_RETRIES) throw err;
      // Exponential back-off
      await new Promise((r) => setTimeout(r, 1000 * 2 ** retries));
    }
  }
}

module.exports = { connectDB };
