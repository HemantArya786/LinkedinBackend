'use strict';

/**
 * Application-level error with HTTP status code.
 * Extend Error rather than create a plain object so stack traces work.
 */
class AppError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;   // distinguish from programming bugs
    this.errors = errors;        // field-level validation errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Wraps async route handlers to avoid repetitive try/catch.
 * Usage: router.get('/path', asyncHandler(async (req, res, next) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { AppError, asyncHandler };
