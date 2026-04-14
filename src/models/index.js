'use strict';

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// COMMENT
// Flat structure with parentId for nested/threaded comments.
// Avoids deep-nesting arrays (MongoDB 16 MB doc limit anti-pattern).
// ─────────────────────────────────────────────────────────────────────────────
const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // null = top-level comment; ObjectId = reply to another comment
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    text: {
      type: String,
      required: true,
      maxlength: 1200,
    },
    reactionsCount: {
      like: { type: Number, default: 0 },
      celebrate: { type: Number, default: 0 },
    },
    isDeleted: { type: Boolean, default: false }, // soft delete
  },
  { timestamps: true }
);

commentSchema.index({ postId: 1, parentId: 1, createdAt: 1 });
commentSchema.index({ userId: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// REACTION
// One doc per (user, target).  Unique compound index prevents duplicates.
// ─────────────────────────────────────────────────────────────────────────────
const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true,
    },
    type: {
      type: String,
      enum: ['like', 'celebrate', 'support', 'insightful', 'funny'],
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate reactions; allow fast lookup
reactionSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
reactionSchema.index({ targetId: 1, targetType: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
const connectionSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

connectionSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });
connectionSchema.index({ receiverId: 1, status: 1 });
connectionSchema.index({ senderId: 1, status: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────
const conversationSchema = new mongoose.Schema(
  {
    // For 1:1 chats keep exactly 2 participants
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Snapshot of last message for quick rendering in inbox
    lastMessage: {
      content: String,
      senderId: mongoose.Schema.Types.ObjectId,
      sentAt: Date,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 }); // sort inbox by most recent

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'gif', 'link'],
      default: 'text',
    },
    mediaUrl: String,      // for image/gif types
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['like', 'comment', 'connection_request', 'connection_accepted', 'message', 'mention'],
      required: true,
    },
    // The actor who triggered the notification
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Generic reference (postId, commentId, conversationId, etc.)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    referenceType: {
      type: String,
      enum: ['post', 'comment', 'connection', 'message'],
    },
    message: String,   // pre-rendered text for quick display
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  Comment: mongoose.model('Comment', commentSchema),
  Reaction: mongoose.model('Reaction', reactionSchema),
  Connection: mongoose.model('Connection', connectionSchema),
  Conversation: mongoose.model('Conversation', conversationSchema),
  Message: mongoose.model('Message', messageSchema),
  Notification: mongoose.model('Notification', notificationSchema),
};
