'use strict';

/**
 * Admin Controller
 * All routes here require:  protect + restrictTo('admin')
 *
 * Endpoints:
 *   GET  /api/v1/admin/stats          – platform statistics
 *   GET  /api/v1/admin/users          – paginated user list
 *   GET  /api/v1/admin/users/:id      – user detail + activity
 *   PUT  /api/v1/admin/users/:id/role – change user role
 *   DELETE /api/v1/admin/users/:id    – soft-delete user
 *   GET  /api/v1/admin/posts          – paginated post list
 *   DELETE /api/v1/admin/posts/:id    – remove any post
 */

const mongoose = require('mongoose');
const User = require('../../models/User');
const Post = require('../../models/Post');
const { Comment, Connection, Notification } = require('../../models/index');
const { sendSuccess, parseCursorPagination, buildNextCursor } = require('../../utils/apiResponse');
const { asyncHandler, AppError } = require('../../utils/appError');
const { cache } = require('../../loaders/redis');

// ── GET /admin/stats ──────────────────────────────────────────────────────────
const getPlatformStats = asyncHandler(async (_req, res) => {
  const cacheKey = 'admin:stats';
  let stats = await cache.get(cacheKey);

  if (!stats) {
    const [
      totalUsers,
      totalPosts,
      totalConnections,
      onlineUsers,
      newUsersToday,
      newPostsToday,
    ] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments(),
      Connection.countDocuments({ status: 'accepted' }),
      User.countDocuments({ isOnline: true }),
      User.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      Post.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    // User growth over last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    stats = {
      totalUsers,
      totalPosts,
      totalConnections,
      onlineUsers,
      newUsersToday,
      newPostsToday,
      userGrowth,
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, stats, 300);
  }

  sendSuccess(res, { stats });
});

// ── GET /admin/users ──────────────────────────────────────────────────────────
const listUsers = asyncHandler(async (req, res) => {
  const { filter, limit } = parseCursorPagination(req.query);
  const query = {};
  if (filter._id) query._id = filter._id;

  // Optional filters
  if (req.query.role) query.role = req.query.role;
  if (req.query.online === 'true') query.isOnline = true;

  const users = await User.find(query)
    .select('name email headline role isOnline createdAt connectionsCount')
    .sort({ _id: -1 })
    .limit(limit)
    .lean();

  sendSuccess(res, { users }, 200, { nextCursor: buildNextCursor(users), limit });
});

// ── GET /admin/users/:id ──────────────────────────────────────────────────────
const getUserDetail = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const [user, postCount, connectionCount] = await Promise.all([
    User.findById(userId)
      .select('-password -refreshTokens')
      .lean(),
    Post.countDocuments({ author: userId }),
    Connection.countDocuments({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: 'accepted',
    }),
  ]);

  if (!user) throw new AppError('User not found', 404);

  sendSuccess(res, { user: { ...user, postCount, connectionCount } });
});

// ── PUT /admin/users/:id/role ─────────────────────────────────────────────────
const changeUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    throw new AppError('Invalid role. Must be "user" or "admin"', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  ).select('name email role');

  if (!user) throw new AppError('User not found', 404);

  // Bust cached profile so next request gets fresh role
  await cache.del(`user:profile:${req.params.id}`);

  sendSuccess(res, { user });
});

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Prevent deleting yourself
  if (userId === req.user._id.toString()) {
    throw new AppError('Admins cannot delete their own account via admin panel', 400);
  }

  const user = await User.findByIdAndDelete(userId);
  if (!user) throw new AppError('User not found', 404);

  // Clean up associated data in parallel
  await Promise.all([
    Post.deleteMany({ author: userId }),
    Comment.deleteMany({ userId }),
    Connection.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }),
    Notification.deleteMany({ $or: [{ userId }, { actorId: userId }] }),
    cache.del(`user:profile:${userId}`, `feed:${userId}`),
  ]);

  res.status(204).send();
});

// ── GET /admin/posts ──────────────────────────────────────────────────────────
const listPosts = asyncHandler(async (req, res) => {
  const { filter, limit } = parseCursorPagination(req.query);
  const query = {};
  if (filter._id) query._id = filter._id;

  const posts = await Post.find(query)
    .populate('author', 'name email')
    .sort({ _id: -1 })
    .limit(limit)
    .lean();

  sendSuccess(res, { posts }, 200, { nextCursor: buildNextCursor(posts), limit });
});

// ── DELETE /admin/posts/:id ───────────────────────────────────────────────────
const adminDeletePost = asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  if (!post) throw new AppError('Post not found', 404);

  await Promise.all([
    Comment.deleteMany({ postId: req.params.id }),
    cache.del(`feed:${post.author}`),
  ]);

  res.status(204).send();
});

module.exports = {
  getPlatformStats,
  listUsers,
  getUserDetail,
  changeUserRole,
  deleteUser,
  listPosts,
  adminDeletePost,
};
