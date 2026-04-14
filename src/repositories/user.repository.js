'use strict';

const User = require('../models/User');

class UserRepository {
  async findById(id) {
    return User.findById(id).select(User.publicFields).lean();
  }

  async updateById(id, updates) {
    return User.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .select(User.publicFields)
      .lean();
  }

  /**
   * Full-text search on name + headline (uses text index).
   * Returns paginated results using cursor (last doc _id).
   */
  async search({ query, cursor, limit }) {
    const filter = { $text: { $search: query } };
    if (cursor) filter._id = { $lt: cursor };

    return User.find(filter)
      .select(`${User.publicFields} score`)
      .sort({ score: { $meta: 'textScore' }, _id: -1 })
      .limit(limit)
      .lean();
  }

  async setOnlineStatus(userId, isOnline) {
    return User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeen: isOnline ? undefined : new Date(),
    });
  }

  async incrementConnections(userId, delta) {
    return User.findByIdAndUpdate(userId, {
      $inc: { connectionsCount: delta },
    });
  }
}

module.exports = new UserRepository();
