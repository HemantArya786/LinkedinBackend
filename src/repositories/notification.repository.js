'use strict';

const { Notification } = require('../models/index');

class NotificationRepository {
  async create(data) {
    return Notification.create(data);
  }

  async findForUser({ userId, cursor, limit }) {
    const filter = { userId };
    if (cursor) filter._id = { $lt: cursor };

    return Notification.find(filter)
      .populate('actorId', 'name profileImage')
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
  }

  async markAllRead(userId) {
    return Notification.updateMany({ userId, isRead: false }, { isRead: true });
  }

  async markOneRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );
  }

  async getUnreadCount(userId) {
    return Notification.countDocuments({ userId, isRead: false });
  }

  async deleteOld(userId, daysOld = 90) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    return Notification.deleteMany({ userId, createdAt: { $lt: cutoff } });
  }
}

module.exports = new NotificationRepository();
