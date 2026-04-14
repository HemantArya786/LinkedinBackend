'use strict';

const { Redis } = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let redisClient;
let redisSubscriber; // Separate subscriber connection for pub/sub

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
    lazyConnect: false,
  });

  client.on('connect', () => logger.info('✅  Redis connected'));
  client.on('error', (err) => logger.error('Redis error', { err }));
  client.on('reconnecting', () => logger.warn('Redis reconnecting…'));

  return client;
}

function getRedisClient() {
  if (!redisClient) redisClient = createClient();
  return redisClient;
}

function getRedisSubscriber() {
  if (!redisSubscriber) redisSubscriber = createClient();
  return redisSubscriber;
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
    if (keys.length) await getRedisClient().del(...keys);
  },

  async exists(key) {
    return getRedisClient().exists(key);
  },
};

module.exports = { getRedisClient, getRedisSubscriber, cache };
