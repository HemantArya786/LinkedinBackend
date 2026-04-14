'use strict';

/**
 * security.js – additional security hardening middleware.
 *
 * Applied in app.js after helmet but before routes.
 *
 * Covers:
 *   1. NoSQL injection prevention (strip $ and . from req.body/query/params)
 *   2. XSS sanitisation (strip HTML tags from string inputs)
 *   3. HTTP Parameter Pollution (HPP) – normalise duplicate query params
 *   4. Request size guard
 */

const { AppError } = require('../utils/appError');

// ── 1. NoSQL Injection Guard ──────────────────────────────────────────────────
// MongoDB operators like { $where: "..." } injected via JSON body can be
// dangerous. Strip any key starting with $ or containing a dot.

function sanitiseObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      sanitiseObject(obj[key]);
    }
  }
  return obj;
}

const mongoSanitize = (req, _res, next) => {
  sanitiseObject(req.body);
  sanitiseObject(req.query);
  sanitiseObject(req.params);
  next();
};

// ── 2. XSS Sanitiser ─────────────────────────────────────────────────────────
// Strips HTML/script tags from string fields.
// For richer sanitisation, use the `xss` npm package.

function stripTags(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '');
}

function sanitiseStrings(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = stripTags(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitiseStrings(obj[key]);
    }
  }
}

const xssSanitize = (req, _res, next) => {
  sanitiseStrings(req.body);
  next();
};

// ── 3. HTTP Parameter Pollution Prevention ────────────────────────────────────
// If a param is passed as an array (e.g. ?sort=asc&sort=desc),
// normalise it by keeping only the last value.
// Whitelist params that legitimately accept arrays (e.g. interests[]).

const HPP_WHITELIST = new Set(['interests', 'ids', 'type']);

const hpp = (req, _res, next) => {
  for (const key of Object.keys(req.query)) {
    if (Array.isArray(req.query[key]) && !HPP_WHITELIST.has(key)) {
      req.query[key] = req.query[key][req.query[key].length - 1];
    }
  }
  next();
};

// ── 4. Suspicious request detector ───────────────────────────────────────────
// Rejects requests with deeply nested JSON (> 5 levels) to prevent
// prototype pollution and parser DoS.

function getDepth(obj, depth = 0) {
  if (depth > 5) return depth;
  if (!obj || typeof obj !== 'object') return depth;
  return Math.max(...Object.values(obj).map((v) => getDepth(v, depth + 1)));
}

const depthGuard = (req, _res, next) => {
  if (req.body && getDepth(req.body) > 5) {
    return next(new AppError('Request body is too deeply nested', 400));
  }
  next();
};

module.exports = { mongoSanitize, xssSanitize, hpp, depthGuard };
