'use strict';

const { Redis } = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let redisClient;
let redisSubscriber; // Separate subscriber connection for pub/sub
let useMemoryCache = false;

/**
 * In-memory cache for development when Redis is unavailable
 */
class MemoryCache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  async get(key) {
    const value = this.store.get(key);
    await Promise.resolve();
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, ttl) {
    await Promise.resolve();
    const serialised = JSON.stringify(value);
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    this.store.set(key, serialised);
    if (ttl) {
      const timer = setTimeout(() => {
        this.store.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);
      this.timers.set(key, timer);
    }
  }

  async del(...keys) {
    await Promise.resolve();
    keys.forEach((key) => {
      this.store.delete(key);
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
    });
  }

  async exists(key) {
    await Promise.resolve();
    return this.store.has(key) ? 1 : 0;
  }

  on() {
    // No-op for memory cache
  }

  async quit() {
    await Promise.resolve();
    this.store.clear();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }
}

let memoryCache = null;

function createClient() {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis retry #${times}, next attempt in ${delay}ms`);
      return delay;
    },
    lazyConnect: true, // Don't auto-connect; we'll handle it in initRedis()
  });

  client.on('connect', () => logger.info('✅  Redis connected'));
  client.on('error', (err) => logger.error('Redis error', { err }));
  client.on('reconnecting', () => logger.warn('Redis reconnecting…'));

  return client;
}

function getRedisClient() {
  if (useMemoryCache) {
    if (!memoryCache) {
      memoryCache = new MemoryCache();
    }
    return memoryCache;
  }
  if (!redisClient) {
    redisClient = createClient();
  }
  return redisClient;
}

function getRedisSubscriber() {
  if (useMemoryCache) {
    if (!memoryCache) {
      memoryCache = new MemoryCache();
    }
    return memoryCache;
  }
  if (!redisSubscriber) {
    redisSubscriber = createClient();
  }
  return redisSubscriber;
}

/**
 * Try to connect to Redis; fallback to memory cache in development
 */
async function initRedis() {
  try {
    const client = createClient();
    // Set a timeout for connection attempt
    const connectionPromise = Promise.race([
      (async () => {
        await client.connect();
        await client.ping();
        return client;
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 3000)
      ),
    ]);

    redisClient = await connectionPromise;
    logger.info('✅  Redis connected');
    redisSubscriber = createClient();
    await redisSubscriber.connect();
  } catch (err) {
    if (config.env === 'development' || config.env === 'test') {
      logger.warn('⚠️  Redis unavailable, falling back to in-memory cache for development');
      useMemoryCache = true;
      memoryCache = new MemoryCache();
    } else {
      throw err;
    }
  }
}

/**
 * Simple cache helpers used across services.
 */
const cache = {
  async get(key) {
    const val = await getRedisClient().get(key);
    return val ? JSON.parse(val) : null;
  },

  async set(key, value, ttl) {
    const serialised = JSON.stringify(value);
    if (ttl) {
      await getRedisClient().setex(key, ttl, serialised);
    } else {
      await getRedisClient().set(key, serialised);
    }
  },

  async del(...keys) {
    if (keys.length) {
      await getRedisClient().del(...keys);
    }
  },

  async exists(key) {
    await Promise.resolve();
    return getRedisClient().exists(key);
  },
};

module.exports = { initRedis, getRedisClient, getRedisSubscriber, cache };
