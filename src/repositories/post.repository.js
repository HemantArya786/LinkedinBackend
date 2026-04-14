'use strict';

const Post = require('../models/Post');
const { Connection } = require('../models/index');

class PostRepository {
  async create(data) {
    return Post.create(data);
  }

  async findById(id) {
    return Post.findById(id).populate('author', 'name headline profileImage').lean();
  }

  async deleteById(id) {
    return Post.findByIdAndDelete(id);
  }

  /**
   * Aggregation-based feed.
   *
   * Strategy:
   *  1. Find accepted connection IDs for the user.
   *  2. Fetch posts from self + connections (visibility: public OR connections).
   *  3. Also include public posts from non-connections for discovery.
   *  4. Cursor-paginate by _id descending (newest first).
   *
   * For 1M+ users this should be backed by a pre-computed feed stored in Redis.
   * See FeedService for the cached layer.
   */
  async getFeedPosts({ userId, connectionIds, cursor, limit }) {
    const filter = {
      $or: [
        // Posts from self or connections (any visibility)
        { author: { $in: [userId, ...connectionIds] } },
        // Public posts from anyone (discovery)
        { visibility: 'public' },
      ],
    };
    if (cursor) filter._id = { $lt: cursor };

    return Post.find(filter)
      .populate('author', 'name headline profileImage isOnline')
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
  }

  async getByAuthor({ authorId, cursor, limit }) {
    const filter = { author: authorId };
    if (cursor) filter._id = { $lt: cursor };
    return Post.find(filter)
      .populate('author', 'name headline profileImage')
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
  }

  async incrementCommentCount(postId, delta = 1) {
    return Post.findByIdAndUpdate(postId, { $inc: { commentsCount: delta } });
  }

  async incrementReactionCount(postId, reactionType, delta = 1) {
    return Post.findByIdAndUpdate(postId, {
      $inc: { [`reactionsCount.${reactionType}`]: delta },
    });
  }
}

module.exports = new PostRepository();
