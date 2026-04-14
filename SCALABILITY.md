# Scalability & Performance Guide

## Designed for 1 Million+ Users

---

## 1. MongoDB Index Strategy

Run this script against your database to create/verify all indexes:

```js
// In mongosh
use linkedin_clone;

// ── User ──────────────────────────────────────────────────────────────────────
db.users.createIndex({ email: 1 },       { unique: true });
db.users.createIndex({ googleId: 1 },    { unique: true, sparse: true });
db.users.createIndex({ name: "text", headline: "text" }); // full-text search
db.users.createIndex({ isOnline: 1 });
db.users.createIndex({ createdAt: -1 });

// ── Post ──────────────────────────────────────────────────────────────────────
db.posts.createIndex({ author: 1, createdAt: -1 }); // author's timeline
db.posts.createIndex({ createdAt: -1 });             // global feed sort
db.posts.createIndex({ visibility: 1, createdAt: -1 });
db.posts.createIndex({ content: "text" });           // post search

// ── Comment ───────────────────────────────────────────────────────────────────
db.comments.createIndex({ postId: 1, parentId: 1, createdAt: 1 });

// ── Reaction ──────────────────────────────────────────────────────────────────
db.reactions.createIndex({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
db.reactions.createIndex({ targetId: 1, targetType: 1 }); // all reactions on a post

// ── Connection ────────────────────────────────────────────────────────────────
db.connections.createIndex({ senderId: 1, receiverId: 1 }, { unique: true });
db.connections.createIndex({ receiverId: 1, status: 1 });  // pending requests inbox
db.connections.createIndex({ senderId: 1, status: 1 });

// ── Conversation ─────────────────────────────────────────────────────────────
db.conversations.createIndex({ participants: 1 });
db.conversations.createIndex({ updatedAt: -1 });           // inbox sort

// ── Message ───────────────────────────────────────────────────────────────────
db.messages.createIndex({ conversationId: 1, createdAt: 1 });

// ── Notification ─────────────────────────────────────────────────────────────
db.notifications.createIndex({ userId: 1, isRead: 1, createdAt: -1 });
```

---

## 2. Redis Caching Strategy

| Cache Key Pattern         | TTL     | Invalidated When             |
|---------------------------|---------|------------------------------|
| `user:profile:<userId>`   | 15 min  | Profile updated, logout      |
| `feed:<userId>`           | 5 min   | User posts / deletes a post  |
| `post:<postId>`           | 10 min  | Post updated / deleted       |

### Fan-out-on-write (for large scale)

When a user with 10,000 connections posts:
1. Post is saved to MongoDB.
2. A BullMQ job fans out the post ID to each follower's feed list in Redis.
3. Feed reads from Redis list (O(1)), falling back to DB aggregation on miss.

This pattern is already scaffolded in `src/jobs/index.js` — extend the notification worker.

---

## 3. Horizontal Scaling Checklist

- ✅ **Stateless API servers** — no in-memory session state
- ✅ **JWT authentication** — tokens are self-contained
- ✅ **Redis adapter** for Socket.IO — events propagate across all instances
- ✅ **BullMQ workers** — can run in separate processes / containers
- ✅ **MongoDB connection pool** — `maxPoolSize: 10` per instance
- ✅ **Graceful shutdown** — drains in-flight requests before exit
- ✅ **Health check endpoint** — `/health` for load balancer probes
- ✅ **PM2 cluster mode** — utilises all CPU cores on a single machine

---

## 4. Query Optimisation Patterns

### Avoid N+1 — use $lookup or $in

```js
// ❌ N+1 – one DB call per connection
const connections = await Connection.find({ userId });
for (const c of connections) {
  const user = await User.findById(c.receiverId); // N queries!
}

// ✅ Single query with $in
const ids = connections.map(c => c.receiverId);
const users = await User.find({ _id: { $in: ids } }).lean();
```

### Lean queries for reads

```js
// Always use .lean() for read-only operations — returns plain JS objects
// (3–5x faster than full Mongoose documents)
const posts = await Post.find(filter).lean();
```

### Projection — never SELECT *

```js
// Only fetch fields the client actually needs
await User.find().select('name profileImage headline isOnline').lean();
```

### Cursor pagination over skip/offset

```js
// ❌ Skip-based — O(N) scan, gets slower as offset grows
Post.find().skip(10000).limit(20);

// ✅ Cursor-based — O(1) with index on _id
Post.find({ _id: { $lt: lastSeenId } }).limit(20);
```

---

## 5. Load Test Benchmarks (Targets)

| Endpoint | Target RPS | p95 Latency |
|---|---|---|
| `GET /posts/feed` (cached) | 5,000 | < 20ms |
| `GET /posts/feed` (cold)   | 500   | < 200ms |
| `GET /users/:id` (cached)  | 8,000 | < 10ms |
| `POST /auth/login`         | 200   | < 100ms |
| Socket.IO connections      | 50,000 concurrent | — |

Run with: `npm install -g artillery` then `artillery run load-test.yml`

---

## 6. Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets (32+ random chars)
- [ ] Enable MongoDB authentication
- [ ] Set Redis `requirepass`
- [ ] Configure SSL in Nginx
- [ ] Set up log rotation
- [ ] Configure Cloudinary rate limits
- [ ] Enable MongoDB oplog for replica set
- [ ] Set up alerting (Datadog / New Relic / Grafana)
- [ ] Configure backup strategy for MongoDB
- [ ] Enable MongoDB Atlas Performance Advisor for index recommendations
