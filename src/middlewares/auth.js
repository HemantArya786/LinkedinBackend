'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { AppError, asyncHandler } = require('../utils/appError');
const User = require('../models/User');
const { cache } = require('../loaders/redis');
const config = require('../config');

/**
 * protect – verifies Bearer JWT and attaches user to req.
 * Uses Redis to cache the user profile and avoid a DB hit on every request.
 */
const protect = asyncHandler(async (req, _res, next) => {
  // 1. Extract token
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) throw new AppError('Not authenticated', 401);

  // 2. Verify
  const decoded = verifyAccessToken(token);

  // 3. Try cache first
  const cacheKey = `user:profile:${decoded.id}`;
  let user = await cache.get(cacheKey);

  if (!user) {
    user = await User.findById(decoded.id).select('-refreshTokens').lean();
    if (!user) throw new AppError('User no longer exists', 401);
    await cache.set(cacheKey, user, config.redis.ttl.userProfile);
  }

  req.user = user;
  next();
});

/**
 * restrictTo – role-based access control.
 * Usage: router.delete('/admin/x', protect, restrictTo('admin'), handler)
 */
const restrictTo =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };

module.exports = { protect, restrictTo };
