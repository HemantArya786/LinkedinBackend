'use strict';

const { Conversation, Message } = require('../models/index');

class MessageRepository {
  async findOrCreateConversation(participantA, participantB) {
    let conv = await Conversation.findOne({
      participants: { $all: [participantA, participantB], $size: 2 },
    }).lean();

    if (!conv) {
      conv = await Conversation.create({ participants: [participantA, participantB] });
    }
    return conv;
  }

  async getUserConversations({ userId, cursor, limit }) {
    const filter = { participants: userId };
    if (cursor) filter._id = { $lt: cursor };

    return Conversation.find(filter)
      .populate('participants', 'name profileImage isOnline lastSeen')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }

  async getMessages({ conversationId, cursor, limit }) {
    const filter = { conversationId, isDeleted: false };
    if (cursor) filter._id = { $lt: cursor };

    return Message.find(filter)
      .populate('senderId', 'name profileImage')
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
  }

  async createMessage({ conversationId, senderId, content, type = 'text', mediaUrl }) {
    const [msg] = await Promise.all([
      Message.create({ conversationId, senderId, content, type, mediaUrl }),
      Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: { content, senderId, sentAt: new Date() },
        updatedAt: new Date(),
      }),
    ]);
    return msg;
  }

  async markRead(conversationId, userId) {
    return Message.updateMany(
      { conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
  }

  async getUnreadCount(userId) {
    // Count conversations that have at least one message not read by this user
    const convIds = await Conversation.find({ participants: userId })
      .select('_id')
      .lean();

    const ids = convIds.map((c) => c._id);

    return Message.countDocuments({
      conversationId: { $in: ids },
      senderId: { $ne: userId },
      readBy: { $ne: userId },
      isDeleted: false,
    });
  }
}

module.exports = new MessageRepository();
