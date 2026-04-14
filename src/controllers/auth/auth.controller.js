'use strict';

const authService = require('../../services/auth.service');
const { sendSuccess, sendCreated } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/appError');

/**
 * POST /api/v1/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendCreated(res, result);
});

/**
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  sendSuccess(res, result);
});

/**
 * POST /api/v1/auth/google
 * Expects { code } – the Google OAuth authorisation code from the client.
 */
const googleAuth = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const { OAuth2Client } = require('google-auth-library');
  const config = require('../../config');

  const client = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    'postmessage'
  );

  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.google.clientId,
  });

  const payload = ticket.getPayload();
  const profile = {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };

  const result = await authService.googleAuth(profile);
  sendSuccess(res, result);
});

/**
 * POST /api/v1/auth/refresh
 */
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken);
  sendSuccess(res, result);
});

/**
 * POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout(req.user._id, refreshToken);
  res.status(204).send();
});

module.exports = { register, login, googleAuth, refresh, logout };
