'use strict';

const mongoose = require('mongoose');
const { AppError } = require('../utils/appError');
const logger = require('../utils/logger');
const config = require('../config');

// ── Mongoose-specific error converters ────────────────────────────────────────

function handleCastError(err) {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
}

function handleDuplicateKeyError(err) {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  return new AppError(`Duplicate value for ${field}. Please use another value.`, 409);
}

function handleValidationError(err) {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Validation failed: ${messages.join('. ')}`, 422);
}

// ── Main error handler ────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  let error = err;

  // Convert Mongoose errors to AppErrors
  if (err instanceof mongoose.Error.CastError) error = handleCastError(err);
  else if (err.code === 11000) error = handleDuplicateKeyError(err);
  else if (err instanceof mongoose.Error.ValidationError) error = handleValidationError(err);
  else if (err.name === 'JsonWebTokenError') error = new AppError('Invalid token', 401);
  else if (err.name === 'TokenExpiredError') error = new AppError('Token expired', 401);

  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  // Log server errors
  if (error.statusCode >= 500) {
    logger.error('Unhandled server error', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
    });
  }

  // Dev: full stack; Prod: safe message
  if (config.env === 'development') {
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
      errors: error.errors,
      stack: error.stack,
    });
  }

  if (error.isOperational) {
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
      errors: error.errors,
    });
  }

  // Unknown / programming error – don't leak details
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong. Please try again later.',
  });
};
