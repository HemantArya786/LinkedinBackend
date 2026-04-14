'use strict';

const {
  commentService,
  reactionService,
  connectionService,
  notificationService,
  messageService,
} = require('../../services/social.services');
const { sendSuccess, sendCreated, parseCursorPagination, buildNextCursor } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/appError');

// ─── COMMENT ─────────────────────────────────────────────────────────────────

const createComment = asyncHandler(async (req, res) => {
  const comment = await commentService.createComment({
    userId: req.user._id,
    ...req.body,
  });
  sendCreated(res, { comment });
});

const getComments = asyncHandler(async (req, res) => {
  const { filter, limit } = parseCursorPagination(req.query);
  const comments = await commentService.getComments({
    postId: req.params.postId,
    parentId: req.query.parentId || null,
    cursor: filter._id?.$lt,
    limit,
  });
  sendSuccess(res, { comments }, 200, { nextCursor: buildNextCursor(comments), limit });
});

const deleteComment = asyncHandler(async (req, res) => {
  await commentService.deleteComment(req.params.id, req.user._id);
  res.status(204).send();
});

// ─── REACTION ─────────────────────────────────────────────────────────────────

const toggleReaction = asyncHandler(async (req, res) => {
  const result = await reactionService.toggle({
    userId: req.user._id,
    targetId: req.body.targetId,
    targetType: req.body.targetType,
    type: req.body.type,
  });
  sendSuccess(res, result);
});

// ─── CONNECTION ───────────────────────────────────────────────────────────────

const sendConnectionRequest = asyncHandler(async (req, res) => {
  const conn = await connectionService.sendRequest(req.user._id, req.body.receiverId);
  sendCreated(res, { connection: conn });
});

const respondToConnection = asyncHandler(async (req, res) => {
  const conn = await connectionService.respond(
    req.body.connectionId,
    req.user._id,
    req.body.action
  );
  sendSuccess(res, { connection: conn });
});

const getConnections = asyncHandler(async (req, res) => {
  const { filter, limit } = parseCursorPagination(req.query);
  const connections = await connectionService.getConnections(
    req.user._id,
    filter._id?.$lt,
    limit
  );
  sendSuccess(res, { connections }, 200, { nextCursor: buildNextCursor(connections), limit });
});

// ─── MESSAGE ──────────────────────────────────────────────────────────────────

const getMessages = asyncHandler(async (req, res) => {
  const { filter, limit } = parseCursorPagination(req.query);
  const messages = await messageService.getMessages({
    conversationId: req.params.conversationId,
    cursor: filter._id?.$lt,
    limit,
  });
  sendSuccess(res, { messages }, 200, { nextCursor: buildNextCursor(messages), limit });
});

const sendMessage = asyncHandler(async (req, res) => {
  const message = await messageService.sendMessage({
    senderId: req.user._id,
    ...req.body,
  });
  sendCreated(res, { message });
});

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────

const getNotifications = asyncHandler(async (req, res) => {
  const { filter, limit } = parseCursorPagination(req.query);
  const notifications = await notificationService.getForUser(
    req.user._id,
    filter._id?.$lt,
    limit
  );
  sendSuccess(res, { notifications }, 200, { nextCursor: buildNextCursor(notifications), limit });
});

const markNotificationsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user._id);
  res.status(204).send();
});

module.exports = {
  createComment,
  getComments,
  deleteComment,
  toggleReaction,
  sendConnectionRequest,
  respondToConnection,
  getConnections,
  getMessages,
  sendMessage,
  getNotifications,
  markNotificationsRead,
};
