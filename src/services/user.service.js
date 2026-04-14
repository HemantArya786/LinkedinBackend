'use strict';

const userRepository = require('../repositories/user.repository');
const { cache } = require('../loaders/redis');
const { AppError } = require('../utils/appError');
const config = require('../config');

class UserService {
  async getProfile(userId) {
    const cacheKey = `user:profile:${userId}`;
    let user = await cache.get(cacheKey);
    if (!user) {
      user = await userRepository.findById(userId);
      if (!user) throw new AppError('User not found', 404);
      await cache.set(cacheKey, user, config.redis.ttl.userProfile);
    }
    return user;
  }

  async updateProfile(userId, updates) {
    const user = await userRepository.updateById(userId, updates);
    if (!user) throw new AppError('User not found', 404);
    // Bust the cache so next read is fresh
    await cache.del(`user:profile:${userId}`);
    return user;
  }

  async searchUsers({ query, cursor, limit = 20 }) {
    if (!query || query.trim().length < 2) {
      throw new AppError('Search query must be at least 2 characters', 400);
    }
    return userRepository.search({ query: query.trim(), cursor, limit });
  }
}

module.exports = new UserService();
