'use strict';

const User = require('../models/User');

/**
 * AuthRepository – raw DB operations for authentication.
 * The service layer calls these; no business logic lives here.
 */
class AuthRepository {
  async createUser(data) {
    return User.create(data);
  }

  async findByEmail(email, includePassword = false) {
    const query = User.findOne({ email: email.toLowerCase() });
    if (includePassword) query.select('+password +refreshTokens');
    return query.lean();
  }

  async findById(id, opts = {}) {
    const query = User.findById(id);
    if (opts.includeTokens) query.select('+refreshTokens');
    return query.lean();
  }

  async findByGoogleId(googleId) {
    return User.findOne({ googleId }).lean();
  }

  async pushRefreshToken(userId, hashedToken) {
    return User.findByIdAndUpdate(userId, {
      $push: { refreshTokens: hashedToken },
    });
  }

  async removeRefreshToken(userId, hashedToken) {
    return User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: hashedToken },
    });
  }

  async clearAllRefreshTokens(userId) {
    return User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
  }
}

module.exports = new AuthRepository();
