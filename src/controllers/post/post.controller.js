'use strict';

const postService = require('../../services/post.service');
const { sendSuccess, sendCreated, parseCursorPagination, buildNextCursor } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/appError');

/** POST /api/v1/posts */
const createPost = asyncHandler(async (req, res) => {
  const post = await postService.createPost(req.user._id, req.body);
  sendCreated(res, { post });
});

/** GET /api/v1/posts/feed */
const getFeed = asyncHandler(async (req, res) => {
  const { filter, limit } = parseCursorPagination(req.query);
  const posts = await postService.getFeed({
    userId: req.user._id,
    cursor: filter._id?.$lt,
    limit,
  });
  sendSuccess(res, { posts }, 200, { nextCursor: buildNextCursor(posts), limit });
});

/** DELETE /api/v1/posts/:id */
const deletePost = asyncHandler(async (req, res) => {
  await postService.deletePost(req.params.id, req.user._id);
  res.status(204).send();
});

module.exports = { createPost, getFeed, deletePost };
