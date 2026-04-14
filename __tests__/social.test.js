'use strict';

/**
 * __tests__/social.test.js
 * Tests for connections, comments, and reactions.
 */

const request = require('supertest');
const app = require('../src/app');

// ── Helpers ───────────────────────────────────────────────────────────────────
let userCounter = 0;
async function mkUser() {
  userCounter++;
  const res = await request(app).post('/api/v1/auth/register').send({
    name: `User ${userCounter}`,
    email: `user${userCounter}_${Date.now()}@test.com`,
    password: 'password123',
  });
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTIONS
// ═══════════════════════════════════════════════════════════════════════════════
describe('Connections', () => {
  let alice, bob;

  beforeEach(async () => {
    alice = await mkUser();
    bob = await mkUser();
  });

  it('should send a connection request', async () => {
    const res = await request(app)
      .post('/api/v1/connections/send')
      .set(auth(alice.token))
      .send({ receiverId: bob.user._id });

    expect(res.status).toBe(201);
    expect(res.body.data.connection.status).toBe('pending');
    expect(res.body.data.connection.senderId).toBe(alice.user._id);
    expect(res.body.data.connection.receiverId).toBe(bob.user._id);
  });

  it('should not allow duplicate connection requests', async () => {
    await request(app)
      .post('/api/v1/connections/send')
      .set(auth(alice.token))
      .send({ receiverId: bob.user._id });

    const res = await request(app)
      .post('/api/v1/connections/send')
      .set(auth(alice.token))
      .send({ receiverId: bob.user._id });

    expect(res.status).toBe(409);
  });

  it('should not allow connecting to yourself', async () => {
    const res = await request(app)
      .post('/api/v1/connections/send')
      .set(auth(alice.token))
      .send({ receiverId: alice.user._id });

    expect(res.status).toBe(400);
  });

  it('should accept a connection request and update counts', async () => {
    // Alice sends
    const sendRes = await request(app)
      .post('/api/v1/connections/send')
      .set(auth(alice.token))
      .send({ receiverId: bob.user._id });

    const connId = sendRes.body.data.connection._id;

    // Bob accepts
    const res = await request(app)
      .post('/api/v1/connections/respond')
      .set(auth(bob.token))
      .send({ connectionId: connId, action: 'accept' });

    expect(res.status).toBe(200);
    expect(res.body.data.connection.status).toBe('accepted');
  });

  it('should reject a connection request', async () => {
    const sendRes = await request(app)
      .post('/api/v1/connections/send')
      .set(auth(alice.token))
      .send({ receiverId: bob.user._id });

    const connId = sendRes.body.data.connection._id;

    const res = await request(app)
      .post('/api/v1/connections/respond')
      .set(auth(bob.token))
      .send({ connectionId: connId, action: 'reject' });

    expect(res.status).toBe(200);
    expect(res.body.data.connection.status).toBe('rejected');
  });

  it('should not allow sender to respond to their own request', async () => {
    const sendRes = await request(app)
      .post('/api/v1/connections/send')
      .set(auth(alice.token))
      .send({ receiverId: bob.user._id });

    const connId = sendRes.body.data.connection._id;

    const res = await request(app)
      .post('/api/v1/connections/respond')
      .set(auth(alice.token))
      .send({ connectionId: connId, action: 'accept' });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════════════════════
describe('Comments', () => {
  let alice, postId;

  beforeEach(async () => {
    alice = await mkUser();
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set(auth(alice.token))
      .send({ content: 'Post for commenting', visibility: 'public' });
    postId = postRes.body.data.post._id;
  });

  it('should create a top-level comment', async () => {
    const res = await request(app)
      .post('/api/v1/comments')
      .set(auth(alice.token))
      .send({ postId, text: 'Great post!' });

    expect(res.status).toBe(201);
    expect(res.body.data.comment.text).toBe('Great post!');
    expect(res.body.data.comment.parentId).toBeNull();
  });

  it('should create a reply comment', async () => {
    const commentRes = await request(app)
      .post('/api/v1/comments')
      .set(auth(alice.token))
      .send({ postId, text: 'Parent comment' });

    const parentId = commentRes.body.data.comment._id;

    const res = await request(app)
      .post('/api/v1/comments')
      .set(auth(alice.token))
      .send({ postId, text: 'This is a reply', parentId });

    expect(res.status).toBe(201);
    expect(res.body.data.comment.parentId).toBe(parentId);
  });

  it('should fetch comments for a post', async () => {
    await request(app)
      .post('/api/v1/comments')
      .set(auth(alice.token))
      .send({ postId, text: 'Comment 1' });

    await request(app)
      .post('/api/v1/comments')
      .set(auth(alice.token))
      .send({ postId, text: 'Comment 2' });

    const res = await request(app)
      .get(`/api/v1/comments/${postId}`)
      .set(auth(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data.comments.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
describe('Reactions', () => {
  let alice, bob, postId;

  beforeEach(async () => {
    alice = await mkUser();
    bob = await mkUser();

    const postRes = await request(app)
      .post('/api/v1/posts')
      .set(auth(alice.token))
      .send({ content: 'React to this', visibility: 'public' });
    postId = postRes.body.data.post._id;
  });

  it('should add a reaction', async () => {
    const res = await request(app)
      .post('/api/v1/reactions/toggle')
      .set(auth(bob.token))
      .send({ targetId: postId, targetType: 'post', type: 'like' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('added');
    expect(res.body.data.type).toBe('like');
  });

  it('should remove a reaction on second toggle (same type)', async () => {
    await request(app)
      .post('/api/v1/reactions/toggle')
      .set(auth(bob.token))
      .send({ targetId: postId, targetType: 'post', type: 'like' });

    const res = await request(app)
      .post('/api/v1/reactions/toggle')
      .set(auth(bob.token))
      .send({ targetId: postId, targetType: 'post', type: 'like' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('removed');
  });

  it('should change reaction type', async () => {
    await request(app)
      .post('/api/v1/reactions/toggle')
      .set(auth(bob.token))
      .send({ targetId: postId, targetType: 'post', type: 'like' });

    const res = await request(app)
      .post('/api/v1/reactions/toggle')
      .set(auth(bob.token))
      .send({ targetId: postId, targetType: 'post', type: 'celebrate' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('changed');
    expect(res.body.data.type).toBe('celebrate');
  });
});
