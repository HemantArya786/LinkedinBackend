'use strict';

const bcrypt = require('bcryptjs');
const authRepository = require('../repositories/auth.repository');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { AppError } = require('../utils/appError');
const { cache } = require('../loaders/redis');
const { captureEvent, identifyUser } = require('../loaders/posthog');

class AuthService {
  /**
   * Register a new user with email/password.
   */
  async register(data) {
    const existing = await authRepository.findByEmail(data.email);
    if (existing) throw new AppError('Email already registered', 409);

    const user = await authRepository.createUser(data);
    
    // Track registration
    captureEvent(user._id.toString(), 'user_registered', {
      email: data.email,
      method: 'email_password',
    });
    identifyUser(user._id.toString(), {
      email: data.email,
      name: data.name,
      signed_up_at: new Date().toISOString(),
    });
    
    return this._issueTokens(user);
  }

  /**
   * Login with email + password.
   */
  async login(email, password) {
    // 1. Find user with password field
    const user = await authRepository.findByEmail(email, true);
    if (!user) throw new AppError('Invalid email or password', 401);

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError('Invalid email or password', 401);

    // Track login
    captureEvent(user._id.toString(), 'user_logged_in', {
      method: 'email_password',
    });

    return this._issueTokens(user);
  }

  /**
   * Upsert Google OAuth user, return tokens.
   */
  async googleAuth(profile) {
    let user = await authRepository.findByGoogleId(profile.googleId);

    if (!user) {
      // Check if email already used (link accounts)
      user = await authRepository.findByEmail(profile.email);
      if (user) {
        // Link Google to existing account (update in place)
        user = await require('../models/User')
          .findByIdAndUpdate(user._id, { googleId: profile.googleId }, { new: true })
          .lean();
        captureEvent(user._id.toString(), 'google_linked', {
          email: profile.email,
        });
      } else {
        user = await authRepository.createUser({
          name: profile.name,
          email: profile.email,
          googleId: profile.googleId,
          profileImage: profile.picture ? { url: profile.picture } : undefined,
        });
        captureEvent(user._id.toString(), 'user_registered', {
          email: profile.email,
          method: 'google_oauth',
        });
        identifyUser(user._id.toString(), {
          email: profile.email,
          name: profile.name,
          signed_up_at: new Date().toISOString(),
        });
      }
    } else {
      // Existing user logging in via Google
      captureEvent(user._id.toString(), 'user_logged_in', {
        method: 'google_oauth',
      });
    }

    return this._issueTokens(user);
  }

  /**
   * Rotate refresh token (issue new pair, revoke old).
   */
  async refresh(oldRefreshToken) {
    const decoded = verifyRefreshToken(oldRefreshToken);

    const hashedOld = await bcrypt.hash(oldRefreshToken, 1); // deterministic enough for revocation
    // NOTE: for production use a faster hash or store the token hash directly

    const user = await authRepository.findById(decoded.id, { includeTokens: true });
    if (!user) throw new AppError('User not found', 401);

    // Revoke old, store new
    const newRefreshToken = signRefreshToken({ id: user._id });
    const hashedNew = await bcrypt.hash(newRefreshToken, 8);

    await authRepository.removeRefreshToken(user._id, hashedOld);
    await authRepository.pushRefreshToken(user._id, hashedNew);

    const accessToken = signAccessToken({ id: user._id, role: user.role });

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout: remove refresh token + bust cache.
   */
  async logout(userId, refreshToken) {
    if (refreshToken) {
      await authRepository.removeRefreshToken(userId, refreshToken);
    }
    await cache.del(`user:profile:${userId}`);
    
    // Track logout
    captureEvent(userId.toString(), 'user_logged_out');
  }

  // ── Private ────────────────────────────────────────────────────────────────

  async _issueTokens(user) {
    const payload = { id: user._id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store hashed refresh token
    const hashed = await bcrypt.hash(refreshToken, 8);
    await authRepository.pushRefreshToken(user._id, hashed);

    // Strip sensitive fields before returning
    const { password, refreshTokens, ...safeUser } = user;

    return { accessToken, refreshToken, user: safeUser };
  }
}

module.exports = new AuthService();
