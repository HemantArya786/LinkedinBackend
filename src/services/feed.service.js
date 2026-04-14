'use strict';

/**
 * FeedService – fan-out-on-write strategy for personalised feeds.
 *
 * When a user posts:
 *   1. Persist to MongoDB (source of truth).
 *   2. Push post ID to each follower's Redis feed list.
 *   3. Trim list to MAX_FEED_SIZE (2000 items).
 *
 * When a user reads their feed:
 *   1. Read post IDs from Redis list.
 *   2. Batch-fetch post documents from MongoDB.
 *   3. Fall back to aggregation if Redis miss.
 *
 * This pattern avoids real-time aggregation for hot users
 * and keeps feed reads sub-millisecond (Redis LRANGE).
 *
 * Trade-off: celebrities (>10K connections) skip fan-out
 * and get "pull" feed (fetched on read). Threshold: 5000.
 */

const { getRedisClient } = require('../loaders/redis');
const { Connection } = require('../models/index');
const Post = require('../models/Post');
const logger = require('../utils/logger');

const MAX_FEED_SIZE = 2000;       // Max posts stored per user feed in Redis
const CELEB_THRESHOLD = 5000;     // Skip fan-out for users with > 5K connections
const FEED_TTL = 60 * 60 * 24 * 3; // 3 days TTL on feed keys

class FeedService {
  _key(userId) {
    return `feed:v2:${userId}`;
  }

  /**
   * Called after a new post is created.
   * Fans out the postId to all followers' feed lists in Redis.
   */
  async fanOutPost(authorId, postId) {
    const redis = getRedisClient();

    // 1. Get all accepted connections
    const connections = await Connection.find({
      $or: [{ senderId: authorId }, { receiverId: authorId }],
      status: 'accepted',
    })
      .select('senderId receiverId')
      .lean();

    // Skip fan-out for celebrities (use pull model instead)
    if (connections.length > CELEB_THRESHOLD) {
      logger.debug(`Fan-out skipped for celebrity user ${authorId} (${connections.length} connections)`);
      return;
    }

    const followerIds = connections.map((c) =>
      c.senderId.toString() === authorId.toString()
        ? c.receiverId.toString()
        : c.senderId.toString()
    );

    // 2. Also push to author's own feed
    followerIds.push(authorId.toString());

    // 3. Pipeline all LPUSH + LTRIM + EXPIRE in one round trip
    const pipeline = redis.pipeline();
    for (const followerId of followerIds) {
      const key = this._key(followerId);
      pipeline.lpush(key, postId.toString());
      pipeline.ltrim(key, 0, MAX_FEED_SIZE - 1);
      pipeline.expire(key, FEED_TTL);
    }

    await pipeline.exec();
    logger.debug(`Fan-out complete: postId ${postId} → ${followerIds.length} feeds`);
  }

  /**
   * Read paginated feed from Redis for a user.
   * Returns hydrated Post documents.
   *
   * @param {string} userId
   * @param {number} page   – 0-indexed page number (each page = 20 items)
   * @param {number} limit
   */
  async getFromCache(userId, page = 0, limit = 20) {
    const redis = getRedisClient();
    const key = this._key(userId);
    const start = page * limit;
    const stop = start + limit - 1;

    const postIds = await redis.lrange(key, start, stop);
    if (!postIds || postIds.length === 0) return null; // cache miss → fallback

    // Batch fetch posts from MongoDB
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('author', 'name headline profileImage isOnline')
      .lean();

    // Re-order to match Redis list order
    const postMap = new Map(posts.map((p) => [p._id.toString(), p]));
    return postIds.map((id) => postMap.get(id)).filter(Boolean);
  }

  /**
   * Remove a deleted post from all feeds.
   * Only practical for small-scale; at scale use lazy deletion (check existence on read).
   */
  async removePostFromFeeds(authorId, postId) {
    const redis = getRedisClient();

    const connections = await Connection.find({
      $or: [{ senderId: authorId }, { receiverId: authorId }],
      status: 'accepted',
    })
      .select('senderId receiverId')
      .lean();

    const allIds = [
      authorId.toString(),
      ...connections.map((c) =>
        c.senderId.toString() === authorId.toString()
          ? c.receiverId.toString()
          : c.senderId.toString()
      ),
    ];

    const pipeline = redis.pipeline();
    for (const uid of allIds) {
      pipeline.lrem(this._key(uid), 0, postId.toString());
    }
    await pipeline.exec();
  }
}

module.exports = new FeedService();
