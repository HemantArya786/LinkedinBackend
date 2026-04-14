'use strict';

/**
 * __tests__/admin.test.js
 * Tests for admin-only endpoints.
 */

const request = require('supertest');
const app = require('../src/app');

async function makeUser(overrides = {}) {
  const base = {
    name: `User ${Date.now()}`,
    email: `u${Date.now()}@test.com`,
    password: 'password123',
    ...overrides,
  };
  const res = await request(app).post('/api/v1/auth/register').send(base);
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

async function makeAdmin() {
  const User = require('../src/models/User');
  const { token, user } = await makeUser({ name: 'Admin', email: `admin${Date.now()}@test.com` });
  // Promote to admin directly in DB
  await User.findByIdAndUpdate(user._id, { role: 'admin' });
  // Re-login to get token with admin role
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'password123' });
  return { token: loginRes.body.data.accessToken, user };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════════
describe('Admin access control', () => {
  it('should reject unauthenticated requests to admin routes', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    expect(res.status).toBe(401);
  });

  it('should reject regular users from admin routes', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should allow admin users to access admin routes', async () => {
    const { token } = await makeAdmin();
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/v1/admin/stats', () => {
  it('should return platform stats with expected fields', async () => {
    const { token } = await makeAdmin();
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { stats } = res.body.data;
    expect(stats).toHaveProperty('totalUsers');
    expect(stats).toHaveProperty('totalPosts');
    expect(stats).toHaveProperty('totalConnections');
    expect(stats).toHaveProperty('onlineUsers');
    expect(stats).toHaveProperty('newUsersToday');
    expect(stats).toHaveProperty('userGrowth');
    expect(typeof stats.totalUsers).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
describe('Admin user management', () => {
  let adminToken, targetUser;

  beforeEach(async () => {
    const admin = await makeAdmin();
    adminToken = admin.token;
    const target = await makeUser();
    targetUser = target.user;
  });

  it('should list users', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  it('should get user detail', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users/${targetUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBe(targetUser._id);
    expect(res.body.data.user).toHaveProperty('postCount');
  });

  it('should change user role to admin', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/users/${targetUser._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });

  it('should reject invalid role', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/users/${targetUser._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superuser' });

    expect(res.status).toBe(400);
  });

  it('should delete a user and their data', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/users/${targetUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify user is gone
    const checkRes = await request(app)
      .get(`/api/v1/admin/users/${targetUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(checkRes.status).toBe(404);
  });
});
