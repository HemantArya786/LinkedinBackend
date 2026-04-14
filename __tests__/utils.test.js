'use strict';

/**
 * __tests__/utils.test.js
 * Unit tests for utility functions that don't require DB.
 */

// ── JWT Utils ──────────────────────────────────────────────────────────────────
describe('JWT Utilities', () => {
  // Set env vars before requiring module
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_32chars_long!!';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_long!';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  let jwtUtils;
  beforeAll(() => {
    jwtUtils = require('../src/utils/jwt');
  });

  it('should sign and verify an access token', () => {
    const payload = { id: 'user123', role: 'user' };
    const token = jwtUtils.signAccessToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT structure

    const decoded = jwtUtils.verifyAccessToken(token);
    expect(decoded.id).toBe('user123');
    expect(decoded.role).toBe('user');
  });

  it('should sign and verify a refresh token', () => {
    const payload = { id: 'user456' };
    const token = jwtUtils.signRefreshToken(payload);

    const decoded = jwtUtils.verifyRefreshToken(token);
    expect(decoded.id).toBe('user456');
  });

  it('should throw AppError for invalid access token', () => {
    expect(() => jwtUtils.verifyAccessToken('bad.token.here')).toThrow();
  });

  it('should throw AppError for invalid refresh token', () => {
    expect(() => jwtUtils.verifyRefreshToken('bad.token.here')).toThrow();
  });
});

// ── AppError ───────────────────────────────────────────────────────────────────
describe('AppError', () => {
  const { AppError } = require('../src/utils/appError');

  it('should create a 4xx error with status "fail"', () => {
    const err = new AppError('Not found', 404);
    expect(err.statusCode).toBe(404);
    expect(err.status).toBe('fail');
    expect(err.isOperational).toBe(true);
    expect(err.message).toBe('Not found');
  });

  it('should create a 5xx error with status "error"', () => {
    const err = new AppError('Server error', 500);
    expect(err.status).toBe('error');
  });

  it('should accept field-level errors array', () => {
    const errors = [{ field: 'email', message: 'Invalid email' }];
    const err = new AppError('Validation failed', 422, errors);
    expect(err.errors).toEqual(errors);
  });

  it('should be an instance of Error', () => {
    const err = new AppError('Test', 400);
    expect(err).toBeInstanceOf(Error);
  });
});

// ── API Response Helpers ───────────────────────────────────────────────────────
describe('apiResponse helpers', () => {
  const {
    parseCursorPagination,
    buildNextCursor,
  } = require('../src/utils/apiResponse');

  describe('parseCursorPagination', () => {
    it('should return default limit when not specified', () => {
      const { limit } = parseCursorPagination({});
      expect(limit).toBe(20);
    });

    it('should cap limit at 100', () => {
      const { limit } = parseCursorPagination({ limit: '500' });
      expect(limit).toBe(100);
    });

    it('should parse cursor into filter', () => {
      const cursor = '507f1f77bcf86cd799439011';
      const { filter } = parseCursorPagination({ cursor });
      expect(filter._id.$lt).toBe(cursor);
    });

    it('should return empty filter when no cursor', () => {
      const { filter } = parseCursorPagination({});
      expect(filter).toEqual({});
    });
  });

  describe('buildNextCursor', () => {
    it('should return null for empty array', () => {
      expect(buildNextCursor([])).toBeNull();
    });

    it('should return last doc id as string', () => {
      const docs = [
        { _id: { toString: () => 'aaa' } },
        { _id: { toString: () => 'bbb' } },
        { _id: { toString: () => 'ccc' } },
      ];
      expect(buildNextCursor(docs)).toBe('ccc');
    });
  });
});
