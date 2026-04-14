'use strict';

require('dotenv').config();

/**
 * Centralised environment configuration.
 * All process.env reads happen here – never scattered across the codebase.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiVersion: process.env.API_VERSION || 'v1',

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/linkedin_clone',
    options: {
      maxPoolSize: 10,          // Connection pool for high concurrency
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    // Default TTLs (seconds)
    ttl: {
      userProfile: 60 * 15,        // 15 min
      feed: 60 * 5,                // 5 min
      session: 60 * 60 * 24 * 7,  // 7 days
    },
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'change_me_access',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change_me_refresh',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'no-reply@linkedinclone.com',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};

module.exports = config;
