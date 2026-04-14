'use strict';

/**
 * src/loaders/passport.js
 *
 * Configures Passport with Google OAuth 2.0 strategy.
 * Used for server-side OAuth flow (callback URL approach).
 *
 * For the client-side OAuth code-exchange approach (recommended for SPAs),
 * see auth.controller.js → googleAuth which uses google-auth-library directly.
 *
 * Usage (server-side flow):
 *   GET /api/v1/auth/google          → redirects to Google consent screen
 *   GET /api/v1/auth/google/callback → Google redirects back here
 */

const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const config = require('../config');
const authService = require('../services/auth.service');
const logger = require('../utils/logger');

function initPassport() {
  if (!config.google.clientId || !config.google.clientSecret) {
    logger.warn('Google OAuth credentials not configured — skipping Passport setup');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleProfile = {
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value,
          };

          const result = await authService.googleAuth(googleProfile);
          done(null, result);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );

  // Minimal serialisation (stateless JWT — sessions not actually used)
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  logger.info('✅  Passport Google OAuth strategy initialised');
}

module.exports = { initPassport };
