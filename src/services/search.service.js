'use strict';

/**
 * SearchService
 * Provides unified search across Users and Posts using MongoDB text indexes.
 *
 * For production at scale, replace with:
 *   - Elasticsearch / OpenSearch for full-text + faceted search
 *   - MongoDB Atlas Search (Lucene-based, zero extra infra)
 *
 * Current implementation uses native MongoDB $text index which works
 * well up to ~500K documents per collection.
 */

const User = require('../models/User');
const Post = require('../models/Post');
const { cache } = require('../loaders/redis');

class SearchService {
  /**
   * Search users by name or headline.
   * Uses the compound text index: { name: 'text', headline: 'text' }
   */
  async searchUsers({ query, cursor, limit = 20 }) {
    const cacheKey = `search:users:${query}:${cursor || ''}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const filter = { $text: { $search: query } };
    if (cursor) filter._id = { $lt: cursor };

    const users = await User.find(filter, {
      score: { $meta: 'textScore' }, // relevance score
    })
      .select('name email headline profileImage isOnline connectionsCount')
      .sort({ score: { $meta: 'textScore' }, _id: -1 })
      .limit(limit)
      .lean();

    await cache.set(cacheKey, users, 60); // 1 min cache for search
    return users;
  }

  /**
   * Search posts by content.
   * Only returns public posts.
   */
  async searchPosts({ query, cursor, limit = 20 }) {
    const filter = {
      $text: { $search: query },
      visibility: 'public',
    };
    if (cursor) filter._id = { $lt: cursor };

    return Post.find(filter, { score: { $meta: 'textScore' } })
      .populate('author', 'name profileImage headline')
      .sort({ score: { $meta: 'textScore' }, _id: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Unified global search across users + posts.
   * Returns { users: [...], posts: [...] }
   */
  async globalSearch({ query, limit = 5 }) {
    if (!query || query.trim().length < 2) return { users: [], posts: [] };

    const [users, posts] = await Promise.all([
      this.searchUsers({ query: query.trim(), limit }),
      this.searchPosts({ query: query.trim(), limit }),
    ]);

    return { users, posts };
  }

  /**
   * Autocomplete: returns top 5 user names starting with prefix.
   * Uses a case-insensitive regex on the indexed 'name' field.
   * For production scale, use MongoDB Atlas Search autocomplete.
   */
  async autocomplete(prefix) {
    if (!prefix || prefix.length < 2) return [];

    const cacheKey = `autocomplete:${prefix.toLowerCase()}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const results = await User.find({
      name: { $regex: `^${prefix}`, $options: 'i' },
    })
      .select('name profileImage headline')
      .limit(5)
      .lean();

    await cache.set(cacheKey, results, 30); // 30s TTL for autocomplete
    return results;
  }
}

module.exports = new SearchService();
