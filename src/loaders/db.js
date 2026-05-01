'use strict';

const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

let mongoServer = null;

/**
 * Connect to MongoDB with retry logic.
 * In development/test mode, uses mongodb-memory-server if real MongoDB is unavailable.
 */
async function connectDB() {
  const MAX_RETRIES = 5;
  let retries = 0;
  const uri = config.mongo.uri;

  // Try to connect to configured MongoDB first
  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(uri, config.mongo.options);
      logger.info('✅  MongoDB connected');

      // ── Connection event listeners ─────────────────────────────────────────
      mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
      mongoose.connection.on('error', (err) => logger.error('MongoDB error', { err }));
      return;
    } catch (err) {
      retries++;
      logger.error(`MongoDB connection failed (attempt ${retries}/${MAX_RETRIES})`, { err });

      // On last attempt in dev/test mode, try mongodb-memory-server
      if (retries === MAX_RETRIES) {
        if ((config.env === 'development' || config.env === 'test') && !process.env.MONGO_URI) {
          logger.warn('⚠️  Falling back to mongodb-memory-server for development');
          return connectToMemoryDB();
        }
        throw err;
      }

      // Exponential back-off
      await new Promise((r) => setTimeout(r, 1000 * 2 ** retries));
    }
  }
}

/**
 * Use mongodb-memory-server for development when MongoDB is not available
 */
async function connectToMemoryDB() {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, config.mongo.options);
    logger.info('✅  In-memory MongoDB started for development');

    // ── Connection event listeners ─────────────────────────────────────────
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    mongoose.connection.on('error', (err) => logger.error('MongoDB error', { err }));

    return;
  } catch (err) {
    logger.error('Failed to start in-memory MongoDB', { err });
    throw new Error(
      'MongoDB connection failed and mongodb-memory-server unavailable. ' +
      'Please install MongoDB or ensure mongodb-memory-server is available.'
    );
  }
}

/**
 * Gracefully shutdown MongoDB and in-memory server
 */
async function disconnectDB() {
  try {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
      logger.info('In-memory MongoDB stopped');
    }
  } catch (err) {
    logger.error('Error disconnecting from MongoDB', { err });
  }
}

module.exports = { connectDB, disconnectDB };
