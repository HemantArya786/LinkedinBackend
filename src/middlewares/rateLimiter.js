'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

/** General API rate limiter */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,   // 15 min default
  max: config.rateLimit.max,             // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many requests from this IP. Please try again later.',
  },
});

/** Stricter limiter for auth endpoints to prevent brute-force */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

module.exports = { apiLimiter, authLimiter };
