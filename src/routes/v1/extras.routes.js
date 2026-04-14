'use strict';

const { Router } = require('express');
const searchRouter = Router();
const conversationRouter = Router();

const searchService = require('../../services/search.service');
const { messageService } = require('../../services/social.services');
const { protect } = require('../../middlewares/auth');
const { sendSuccess, parseCursorPagination, buildNextCursor } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/appError');

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH  /api/v1/search
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/v1/search?q=nodejs&type=users|posts|all */
searchRouter.get('/', protect, asyncHandler(async (req, res) => {
  const { q: query, type = 'all' } = req.query;
  const { filter, limit } = parseCursorPagination(req.query);
  const cursor = filter._id?.$lt;

  let data;
  if (type === 'users') {
    const users = await searchService.searchUsers({ query, cursor, limit });
    data = { users, nextCursor: buildNextCursor(users) };
  } else if (type === 'posts') {
    const posts = await searchService.searchPosts({ query, cursor, limit });
    data = { posts, nextCursor: buildNextCursor(posts) };
  } else {
    data = await searchService.globalSearch({ query, limit });
  }

  sendSuccess(res, data);
}));

/** GET /api/v1/search/autocomplete?q=joh */
searchRouter.get('/autocomplete', protect, asyncHandler(async (req, res) => {
  const results = await searchService.autocomplete(req.query.q);
  sendSuccess(res, { results });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS  /api/v1/conversations
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /api/v1/conversations  – create or get existing 1:1 conversation */
conversationRouter.post('/', protect, asyncHandler(async (req, res) => {
  const { participantId } = req.body;
  const conv = await messageService.getOrCreateConversation(
    req.user._id,
    participantId
  );
  sendSuccess(res, { conversation: conv });
}));

/** GET /api/v1/conversations – list user's conversations */
conversationRouter.get('/', protect, asyncHandler(async (req, res) => {
  const { Conversation } = require('../../models/index');
  const { filter, limit } = parseCursorPagination(req.query);

  const query = { participants: req.user._id };
  if (filter._id) query._id = filter._id;

  const conversations = await Conversation.find(query)
    .populate('participants', 'name profileImage isOnline lastSeen')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  sendSuccess(res, { conversations }, 200, {
    nextCursor: buildNextCursor(conversations),
    limit,
  });
}));

module.exports = { searchRouter, conversationRouter };
