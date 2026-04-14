'use strict';

/**
 * __tests__/post.test.js
 * Integration tests for post creation, feed, and deletion.
 */

const request = require('supertest');
const app = require('../src/app');

// ── Shared helpers ────────────────────────────────────────────────────────────
async function registerAndLogin(overrides = {}) {
  const user = {
    name: 'Post Tester',
    email: `user_${Date.now()}@test.com`,
    password: 'password123',
    ...overrides,
  };
  const res = await request(app).post('/api/v1/auth/register').send(user);
  return {
    token: res.body.data.accessToken,
    user: res.body.data.user,
  };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createPost(token, content = 'Hello world #test') {
  return request(app)
    .post('/api/v1/posts')
    .set(authHeader(token))
    .send({ content, visibility: 'public' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE POST
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/posts', () => {
  let token;

  beforeEach(async () => {
    ({ token } = await registerAndLogin());
  });

  it('should create a post and return it', async () => {
    const res = await createPost(token, 'My first post!');

    expect(res.status).toBe(201);
    expect(res.body.data.post).toMatchObject({
      content: 'My first post!',
      visibility: 'public',
      commentsCount: 0,
    });
    expect(res.body.data.post.author).toBeDefined();
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .send({ content: 'Sneaky post' });

    expect(res.status).toBe(401);
  });

  it('should reject content exceeding 3000 chars', async () => {
    const res = await createPost(token, 'x'.repeat(3001));
    expect(res.status).toBe(422);
  });

  it('should allow posts with no content (media-only)', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set(authHeader(token))
      .send({ visibility: 'connections' });

    expect(res.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET FEED
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/v1/posts/feed', () => {
  let token;

  beforeEach(async () => {
    ({ token } = await registerAndLogin());
  });

  it('should return an array of posts', async () => {
    await createPost(token, 'Feed test post 1');
    await createPost(token, 'Feed test post 2');

    const res = await request(app)
      .get('/api/v1/posts/feed')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.posts)).toBe(true);
    expect(res.body.data.posts.length).toBeGreaterThanOrEqual(2);
  });

  it('should include pagination meta', async () => {
    const res = await request(app)
      .get('/api/v1/posts/feed?limit=5')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.meta).toHaveProperty('limit');
  });

  it('should paginate correctly using cursor', async () => {
    // Create 5 posts
    for (let i = 0; i < 5; i++) {
      await createPost(token, `Cursor post ${i}`);
    }

    const first = await request(app)
      .get('/api/v1/posts/feed?limit=3')
      .set(authHeader(token));

    const { nextCursor } = first.body.meta;
    expect(nextCursor).toBeTruthy();

    const second = await request(app)
      .get(`/api/v1/posts/feed?limit=3&cursor=${nextCursor}`)
      .set(authHeader(token));

    expect(second.status).toBe(200);
    // Ensure no overlap between pages
    const firstIds = first.body.data.posts.map((p) => p._id);
    const secondIds = second.body.data.posts.map((p) => p._id);
    const overlap = firstIds.filter((id) => secondIds.includes(id));
    expect(overlap.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE POST
// ═══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/v1/posts/:id', () => {
  let token, otherToken, postId;

  beforeEach(async () => {
    ({ token } = await registerAndLogin());
    ({ token: otherToken } = await registerAndLogin({ email: `other_${Date.now()}@test.com` }));

    const res = await createPost(token, 'To be deleted');
    postId = res.body.data.post._id;
  });

  it('should delete own post', async () => {
    const res = await request(app)
      .delete(`/api/v1/posts/${postId}`)
      .set(authHeader(token));

    expect(res.status).toBe(204);
  });

  it('should not allow deleting another user\'s post', async () => {
    const res = await request(app)
      .delete(`/api/v1/posts/${postId}`)
      .set(authHeader(otherToken));

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent post', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/v1/posts/${fakeId}`)
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});
