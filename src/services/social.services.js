'use strict';

// ─── Comment Service ──────────────────────────────────────────────────────────
const { Comment } = require('../models/index');
const postRepository = require('../repositories/post.repository');
const { captureEvent } = require('../loaders/posthog');
const { AppError } = require('../utils/appError');

class CommentService {
  async createComment({ postId, userId, text, parentId }) {
    const post = await postRepository.findById(postId);
    if (!post) throw new AppError('Post not found', 404);

    const comment = await Comment.create({ postId, userId, text, parentId: parentId || null });
    await postRepository.incrementCommentCount(postId, 1);

    // Track comment creation
    captureEvent(userId.toString(), 'comment_created', {
      post_id: postId.toString(),
      is_reply: !!parentId,
    });

    return comment.populate('userId', 'name profileImage headline');
  }

  async getComments({ postId, parentId = null, cursor, limit = 20 }) {
    const filter = { postId, parentId, isDeleted: false };
    if (cursor) filter._id = { $gt: cursor }; // oldest-first for comments

    return Comment.find(filter)
      .populate('userId', 'name profileImage headline')
      .sort({ _id: 1 })
      .limit(limit)
      .lean();
  }

  async deleteComment(commentId, userId) {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.userId.toString() !== userId.toString()) {
      throw new AppError('Not authorised', 403);
    }
    comment.isDeleted = true;
    await comment.save();
    await postRepository.incrementCommentCount(comment.postId, -1);
  }
}

// ─── Reaction Service ─────────────────────────────────────────────────────────
const { Reaction } = require('../models/index');
const Post = require('../models/Post');

class ReactionService {
  async toggle({ userId, targetId, targetType, type }) {
    const existing = await Reaction.findOne({ userId, targetId, targetType });
    const Model = targetType === 'post' ? Post : Comment;

    if (existing) {
      if (existing.type === type) {
        // Same reaction → remove it
        await existing.deleteOne();
        await Model.findByIdAndUpdate(targetId, {
          $inc: { [`reactionsCount.${type}`]: -1 },
        });
        captureEvent(userId.toString(), 'reaction_removed', {
          reaction_type: type,
          target_type: targetType,
        });
        return { action: 'removed', type };
      }
      // Different reaction → swap
      const oldType = existing.type;
      existing.type = type;
      await existing.save();
      await Model.findByIdAndUpdate(targetId, {
        $inc: { [`reactionsCount.${oldType}`]: -1, [`reactionsCount.${type}`]: 1 },
      });
      captureEvent(userId.toString(), 'reaction_changed', {
        from_type: oldType,
        to_type: type,
        target_type: targetType,
      });
      return { action: 'changed', type };
    }

    // New reaction
    await Reaction.create({ userId, targetId, targetType, type });
    await Model.findByIdAndUpdate(targetId, {
      $inc: { [`reactionsCount.${type}`]: 1 },
    });
    captureEvent(userId.toString(), 'reaction_added', {
      reaction_type: type,
      target_type: targetType,
    });
    return { action: 'added', type };
  }
}

// ─── Connection Service ───────────────────────────────────────────────────────
const { Connection } = require('../models/index');
const userRepository = require('../repositories/user.repository');

class ConnectionService {
  async sendRequest(senderId, receiverId) {
    if (senderId.toString() === receiverId.toString()) {
      throw new AppError('Cannot connect with yourself', 400);
    }
    const existing = await Connection.findOne({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    });
    if (existing) throw new AppError('Connection request already exists', 409);

    const conn = await Connection.create({ senderId, receiverId });
    
    // Track connection request
    captureEvent(senderId.toString(), 'connection_requested', {
      receiver_id: receiverId.toString(),
    });
    
    return conn;
  }

  async respond(connectionId, userId, action) {
    const conn = await Connection.findById(connectionId);
    if (!conn) throw new AppError('Connection request not found', 404);
    if (conn.receiverId.toString() !== userId.toString()) {
      throw new AppError('Not authorised', 403);
    }
    if (conn.status !== 'pending') throw new AppError('Already responded', 400);

    conn.status = action === 'accept' ? 'accepted' : 'rejected';
    await conn.save();

    if (action === 'accept') {
      await userRepository.incrementConnections(conn.senderId, 1);
      await userRepository.incrementConnections(conn.receiverId, 1);
      
      // Track connection accepted
      captureEvent(userId.toString(), 'connection_accepted', {
        sender_id: conn.senderId.toString(),
      });
    } else {
      // Track connection rejected
      captureEvent(userId.toString(), 'connection_rejected', {
        sender_id: conn.senderId.toString(),
      });
    }
    
    return conn;
  }

  async getConnections(userId, cursor, limit = 20) {
    const filter = {
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: 'accepted',
    };
    if (cursor) filter._id = { $lt: cursor };

    return Connection.find(filter)
      .populate('senderId receiverId', 'name profileImage headline')
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
  }
}

// ─── Notification Service ─────────────────────────────────────────────────────
const { Notification } = require('../models/index');

class NotificationService {
  async create({ userId, type, actorId, referenceId, referenceType, message }) {
    return Notification.create({ userId, type, actorId, referenceId, referenceType, message });
  }

  async getForUser(userId, cursor, limit = 20) {
    const filter = { userId };
    if (cursor) filter._id = { $lt: cursor };
    return Notification.find(filter)
      .populate('actorId', 'name profileImage')
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
  }

  async markAllRead(userId) {
    return Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
  }
}

// ─── Message Service ──────────────────────────────────────────────────────────
const { Conversation, Message } = require('../models/index');

class MessageService {
  async getOrCreateConversation(userA, userB) {
    let conv = await Conversation.findOne({
      participants: { $all: [userA, userB], $size: 2 },
    }).lean();
    if (!conv) {
      conv = await Conversation.create({ participants: [userA, userB] });
    }
    return conv;
  }

  async getMessages({ conversationId, cursor, limit = 30 }) {
    const filter = { conversationId, isDeleted: false };
    if (cursor) filter._id = { $lt: cursor };
    return Message.find(filter)
      .populate('senderId', 'name profileImage')
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
  }

  async sendMessage({ conversationId, senderId, content, type = 'text' }) {
    const [msg] = await Promise.all([
      Message.create({ conversationId, senderId, content, type }),
      Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: { content, senderId, sentAt: new Date() },
        updatedAt: new Date(),
      }),
    ]);
    
    // Track message sent
    captureEvent(senderId.toString(), 'message_sent', {
      message_type: type,
      conversation_id: conversationId.toString(),
    });
    
    return msg.populate('senderId', 'name profileImage');
  }

  async markRead(conversationId, userId) {
    await Message.updateMany(
      { conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
  }
}

module.exports = {
  commentService: new CommentService(),
  reactionService: new ReactionService(),
  connectionService: new ConnectionService(),
  notificationService: new NotificationService(),
  messageService: new MessageService(),
};
