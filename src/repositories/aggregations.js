'use strict';

const Post = require('../models/Post');
const { Connection } = require('../models/index');
const mongoose = require('mongoose');

/**
 * Advanced aggregation pipelines for feed and analytics.
 * These run directly against MongoDB — no application-layer N+1 loops.
 */

/**
 * Personalised feed via aggregation.
 *
 * Pipeline:
 *  1. $lookup  – get accepted connections for userId
 *  2. $match   – posts from self + connections OR public posts
 *  3. $lookup  – join author details
 *  4. $lookup  – check if current user reacted to each post
 *  5. $sort    – newest first
 *  6. $limit
 *
 * For 1M+ users, pre-compute and cache in Redis (fan-out-on-write).
 * This pipeline is used as a fallback when cache misses.
 */
async function getFeedAggregation({ userId, cursor, limit = 20 }) {
  const uid = new mongoose.Types.ObjectId(userId);

  // Step 1: resolve connection IDs
  const connections = await Connection.find({
    $or: [{ senderId: uid }, { receiverId: uid }],
    status: 'accepted',
  })
    .select('senderId receiverId')
    .lean();

  const connectionIds = connections.map((c) =>
    c.senderId.toString() === userId.toString() ? c.receiverId : c.senderId
  );

  const matchStage = {
    $match: {
      ...(cursor ? { _id: { $lt: new mongoose.Types.ObjectId(cursor) } } : {}),
      $or: [
        { author: { $in: [uid, ...connectionIds] } },
        { visibility: 'public' },
      ],
    },
  };

  const pipeline = [
    matchStage,
    { $sort: { _id: -1 } },
    { $limit: limit },

    // Join author
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        pipeline: [
          { $project: { name: 1, headline: 1, profileImage: 1, isOnline: 1 } },
        ],
        as: 'author',
      },
    },
    { $unwind: { path: '$author', preserveNullAndEmpty: false } },

    // Check if requesting user already reacted
    {
      $lookup: {
        from: 'reactions',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$targetId', '$$postId'] },
                  { $eq: ['$targetType', 'post'] },
                  { $eq: ['$userId', uid] },
                ],
              },
            },
          },
          { $project: { type: 1, _id: 0 } },
        ],
        as: 'myReaction',
      },
    },
    {
      $addFields: {
        myReaction: { $arrayElemAt: ['$myReaction.type', 0] },
      },
    },

    // Clean output projection
    {
      $project: {
        content: 1,
        media: 1,
        reactionsCount: 1,
        commentsCount: 1,
        visibility: 1,
        createdAt: 1,
        author: 1,
        myReaction: 1,
      },
    },
  ];

  return Post.aggregate(pipeline);
}

/**
 * Get engagement analytics for a post.
 * Returns total reactions, top reaction type, comment count.
 */
async function getPostAnalytics(postId) {
  const oid = new mongoose.Types.ObjectId(postId);

  const [result] = await Post.aggregate([
    { $match: { _id: oid } },
    {
      $project: {
        totalReactions: {
          $sum: [
            '$reactionsCount.like',
            '$reactionsCount.celebrate',
            '$reactionsCount.support',
            '$reactionsCount.insightful',
            '$reactionsCount.funny',
          ],
        },
        reactionsCount: 1,
        commentsCount: 1,
        createdAt: 1,
      },
    },
  ]);

  return result || null;
}

/**
 * Get all users who reacted to a post with their reaction types.
 * Cursor-paginated.
 */
async function getPostReactors({ postId, cursor, limit = 20 }) {
  const { Reaction } = require('../models/index');
  const filter = { targetId: postId, targetType: 'post' };
  if (cursor) filter._id = { $lt: cursor };

  return Reaction.find(filter)
    .populate('userId', 'name profileImage headline')
    .sort({ _id: -1 })
    .limit(limit)
    .lean();
}

module.exports = { getFeedAggregation, getPostAnalytics, getPostReactors };
