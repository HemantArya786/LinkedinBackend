'use strict';

const Joi = require('joi');
const { AppError } = require('../utils/appError');

/**
 * Factory: returns an Express middleware that validates req[source] against schema.
 * @param {Joi.Schema} schema
 * @param {'body'|'query'|'params'} source
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((d) => ({
      field: d.context?.key,
      message: d.message.replace(/"/g, ''),
    }));
    return next(new AppError('Validation error', 422, errors));
  }

  req[source] = value; // replace with sanitised value
  next();
};

// ── Auth schemas ──────────────────────────────────────────────────────────────
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(64).required(),
  phone: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ── Post schemas ──────────────────────────────────────────────────────────────
const createPostSchema = Joi.object({
  content: Joi.string().max(3000).optional(),
  visibility: Joi.string().valid('public', 'connections').default('public'),
});

// ── Comment schemas ───────────────────────────────────────────────────────────
const createCommentSchema = Joi.object({
  postId: Joi.string().hex().length(24).required(),
  text: Joi.string().max(1200).required(),
  parentId: Joi.string().hex().length(24).optional(),
});

// ── Connection schemas ────────────────────────────────────────────────────────
const sendConnectionSchema = Joi.object({
  receiverId: Joi.string().hex().length(24).required(),
});

const respondConnectionSchema = Joi.object({
  connectionId: Joi.string().hex().length(24).required(),
  action: Joi.string().valid('accept', 'reject').required(),
});

// ── Message schemas ───────────────────────────────────────────────────────────
const sendMessageSchema = Joi.object({
  conversationId: Joi.string().hex().length(24).required(),
  content: Joi.string().max(5000).required(),
  type: Joi.string().valid('text', 'image', 'gif', 'link').default('text'),
});

// ── Profile schema ────────────────────────────────────────────────────────────
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  headline: Joi.string().max(220),
  bio: Joi.string().max(2600),
  interests: Joi.array().items(Joi.string().max(50)).max(20),
  phone: Joi.string(),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  refreshSchema,
  createPostSchema,
  createCommentSchema,
  sendConnectionSchema,
  respondConnectionSchema,
  sendMessageSchema,
  updateProfileSchema,
};
