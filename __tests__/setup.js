'use strict';

/**
 * __tests__/setup.js
 * Global test setup using mongodb-memory-server.
 * Provides an isolated in-memory MongoDB for each test suite.
 *
 * Install:  npm install --save-dev jest mongodb-memory-server supertest
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// ── Mock Redis so tests don't need a real Redis instance ──────────────────────
jest.mock('../src/loaders/redis', () => {
  const store = new Map();
  const cache = {
    get: jest.fn(async (key) => store.get(key) || null),
    set: jest.fn(async (key, value) => store.set(key, value)),
    del: jest.fn(async (...keys) => keys.forEach((k) => store.delete(k))),
    exists: jest.fn(async (key) => store.has(key) ? 1 : 0),
  };
  return {
    getRedisClient: () => ({ ping: jest.fn().mockResolvedValue('PONG'), quit: jest.fn() }),
    getRedisSubscriber: () => ({}),
    cache,
    __store: store, // expose for test assertions
  };
});

// ── Mock BullMQ so no real queue is created ───────────────────────────────────
jest.mock('../src/jobs/index', () => ({
  enqueueNotification: jest.fn().mockResolvedValue({}),
  enqueueEmail: jest.fn().mockResolvedValue({}),
  setIO: jest.fn(),
}));

// ── Start in-memory MongoDB before all tests ──────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

// ── Drop all collections between test files ───────────────────────────────────
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// ── Disconnect + stop after all tests ─────────────────────────────────────────
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
