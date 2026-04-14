'use strict';

const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: String,
    type: { type: String, enum: ['image', 'video'], default: 'image' },
  },
  { _id: false }
);

const reactionsCountSchema = new mongoose.Schema(
  {
    like: { type: Number, default: 0 },
    celebrate: { type: Number, default: 0 },
    support: { type: Number, default: 0 },
    insightful: { type: Number, default: 0 },
    funny: { type: Number, default: 0 },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      maxlength: 3000,
    },
    media: [mediaSchema],

    // Denormalised counters (avoid expensive COUNT(*) queries at scale)
    reactionsCount: { type: reactionsCountSchema, default: () => ({}) },
    commentsCount: { type: Number, default: 0, min: 0 },

    // Visibility
    visibility: {
      type: String,
      enum: ['public', 'connections'],
      default: 'public',
    },

    // Repost support
    repostOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
postSchema.index({ author: 1, createdAt: -1 });          // author's posts feed
postSchema.index({ createdAt: -1 });                     // global feed sort
postSchema.index({ content: 'text' });                   // full-text search
postSchema.index({ visibility: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
