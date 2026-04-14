'use strict';

const postRepository = require('../repositories/post.repository');
const feedService = require('./feed.service');
const { getFeedAggregation } = require('../repositories/aggregations');
const { cache } = require('../loaders/redis');
const { AppError } = require('../utils/appError');
const logger = require('../utils/logger');

class PostService {
  async createPost(authorId, data) {
    // 1. Persist to DB
    const raw = await postRepository.create({ author: authorId, ...data });
    const post = await postRepository.findById(raw._id);

    // 2. Fan-out to followers' Redis feed lists (fire-and-forget)
    feedService.fanOutPost(authorId, raw._id).catch((err) => {
      logger.error('Feed fan-out failed', { err });
    });

    return post;
  }

  async getFeed({ userId, page = 0, limit = 20, cursor }) {
    // 1. Try Redis fan-out feed (page-based for Redis lists)
    const cached = await feedService.getFromCache(userId, page, limit);
    if (cached && cached.length > 0) return cached;

    // 2. Fallback: MongoDB aggregation pipeline (with reaction info baked in)
    return getFeedAggregation({ userId, cursor, limit });
  }

  async deletePost(postId, requesterId) {
    const post = await postRepository.findById(postId);
    if (!post) throw new AppError('Post not found', 404);
    if (post.author._id.toString() !== requesterId.toString()) {
      throw new AppError('You can only delete your own posts', 403);
    }

    await postRepository.deleteById(postId);

    // Remove from Redis feed lists + bust simple cache key
    feedService.removePostFromFeeds(requesterId, postId).catch(() => {});
    await cache.del(`feed:${requesterId}`);
  }

  async getPostById(postId) {
    const post = await postRepository.findById(postId);
    if (!post) throw new AppError('Post not found', 404);
    return post;
  }
}

module.exports = new PostService();
