'use strict';

/**
 * Standardised JSON response format.
 *
 * Success:  { status: 'success', data: {...} }
 * Fail:     { status: 'fail',    message: '...', errors: [...] }
 * Error:    { status: 'error',   message: '...' }
 */

const sendSuccess = (res, data, statusCode = 200, meta = null) => {
  const body = { status: 'success', data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

const sendCreated = (res, data) => sendSuccess(res, data, 201);

const sendNoContent = (res) => res.status(204).send();

/**
 * Build cursor-based pagination params from query string.
 *
 * Clients pass: ?cursor=<lastId>&limit=20
 * Returns MongoDB query fragment + limit.
 */
const parseCursorPagination = (query) => {
  const limit = Math.min(parseInt(query.limit, 10) || 20, 100);
  const cursor = query.cursor || null;

  const filter = cursor ? { _id: { $lt: cursor } } : {};

  return { filter, limit };
};

/**
 * Build a next-cursor string from result set.
 */
const buildNextCursor = (docs) => {
  if (!docs || docs.length === 0) return null;
  return docs[docs.length - 1]._id.toString();
};

module.exports = {
  sendSuccess,
  sendCreated,
  sendNoContent,
  parseCursorPagination,
  buildNextCursor,
};
