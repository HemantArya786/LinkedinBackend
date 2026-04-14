'use strict';

/**
 * __tests__/auth.test.js
 * Integration tests for authentication endpoints.
 * Uses supertest against the Express app + mongodb-memory-server.
 */

const request = require('supertest');
const app = require('../src/app');

// ── Helpers ───────────────────────────────────────────────────────────────────
const validUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'securePass123',
};

async function registerUser(overrides = {}) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...validUser, ...overrides });
}

async function loginUser(email = validUser.email, password = validUser.password) {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/register', () => {
  it('should register a new user and return tokens', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user).toMatchObject({
      name: validUser.name,
      email: validUser.email,
    });
    // Password must never be returned
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('should reject duplicate email', async () => {
    await registerUser();
    const res = await registerUser();

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('should validate required fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'bad-email', password: '123' }); // name missing, short password

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('should reject weak passwords (< 6 chars)', async () => {
    const res = await registerUser({ password: 'abc' });
    expect(res.status).toBe(422);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await registerUser();
  });

  it('should login with correct credentials', async () => {
    const res = await loginUser();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('should reject wrong password', async () => {
    const res = await loginUser(validUser.email, 'wrongpassword');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('should reject non-existent email', async () => {
    const res = await loginUser('nobody@example.com', 'password123');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/refresh', () => {
  it('should issue new tokens with a valid refresh token', async () => {
    const loginRes = await registerUser();
    const { refreshToken } = loginRes.body.data;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    // New refresh token should differ
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('should reject an invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'totally.fake.token' });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/logout', () => {
  it('should log out an authenticated user', async () => {
    const { body } = await registerUser();
    const { accessToken, refreshToken } = body.data;

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(204);
  });

  it('should reject logout without auth header', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });
});
