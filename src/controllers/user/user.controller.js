'use strict';

const userService = require('../../services/user.service');
const { sendSuccess, parseCursorPagination, buildNextCursor } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/appError');

/** GET /api/v1/users/:id */
const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.params.id);
  sendSuccess(res, { user });
});

/** PUT /api/v1/users/profile */
const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body);
  sendSuccess(res, { user });
});

/** GET /api/v1/users/search?query=&cursor=&limit= */
const searchUsers = asyncHandler(async (req, res) => {
  const { filter, limit } = parseCursorPagination(req.query);
  const users = await userService.searchUsers({
    query: req.query.query,
    cursor: filter._id?.$lt,
    limit,
  });
  const nextCursor = buildNextCursor(users);
  sendSuccess(res, { users }, 200, { nextCursor, limit });
});

module.exports = { getProfile, updateProfile, searchUsers };
