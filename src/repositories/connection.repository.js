'use strict';

const { Connection } = require('../models/index');

class ConnectionRepository {
  async create(senderId, receiverId) {
    return Connection.create({ senderId, receiverId });
  }

  async findExisting(userA, userB) {
    return Connection.findOne({
      $or: [
        { senderId: userA, receiverId: userB },
        { senderId: userB, receiverId: userA },
      ],
    }).lean();
  }

  async findById(id) {
    return Connection.findById(id);
  }

  async updateStatus(id, status) {
    return Connection.findByIdAndUpdate(id, { status }, { new: true });
  }

  async getAcceptedConnections({ userId, cursor, limit }) {
    const filter = {
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: 'accepted',
    };
    if (cursor) filter._id = { $lt: cursor };

    return Connection.find(filter)
      .populate('senderId receiverId', 'name profileImage headline isOnline')
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
  }

  async getPendingReceived(userId) {
    return Connection.find({ receiverId: userId, status: 'pending' })
      .populate('senderId', 'name profileImage headline connectionsCount')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getConnectionIds(userId) {
    const conns = await Connection.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: 'accepted',
    })
      .select('senderId receiverId')
      .lean();

    return conns.map((c) =>
      c.senderId.toString() === userId.toString() ? c.receiverId : c.senderId
    );
  }

  async countMutualConnections(userA, userB) {
    const [aIds, bIds] = await Promise.all([
      this.getConnectionIds(userA),
      this.getConnectionIds(userB),
    ]);
    const aSet = new Set(aIds.map(String));
    return bIds.filter((id) => aSet.has(String(id))).length;
  }
}

module.exports = new ConnectionRepository();
