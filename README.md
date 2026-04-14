# LinkedIn-Clone Backend — Production-Ready Node.js API

A **scalable social networking platform** built with Node.js, Express, MongoDB, Redis, Socket.IO, and BullMQ. Architected to handle **1 million+ users** with horizontal scaling support.

---

## 🏗️ Architecture Overview

```
Client → Nginx (Load Balancer)
           ├── Node.js Instance 1  ─┐
           ├── Node.js Instance 2  ─┼── Redis (Pub/Sub + Cache + Queue)
           └── Node.js Instance N  ─┘
                      │
                 MongoDB Replica Set
```

### Request Flow (Controller → Service → Repository)

```
HTTP Request
  └─▶ Route (validation middleware)
        └─▶ Controller (HTTP layer only)
              └─▶ Service (business logic)
                    └─▶ Repository (DB queries)
                          └─▶ MongoDB
```

---

## 📁 Folder Structure

```
src/
├── config/           # Env config (single source of truth)
├── controllers/      # HTTP handlers (thin layer)
│   ├── auth/
│   ├── user/
│   ├── post/
│   └── social/       # comments, reactions, connections, messages, notifications
├── services/         # Business logic
├── repositories/     # MongoDB query layer (no business logic)
├── models/           # Mongoose schemas + indexes
├── routes/v1/        # Express routers with API versioning
├── middlewares/      # auth, errorHandler, rateLimiter
├── validators/       # Joi schemas + validate() factory
├── utils/            # logger, jwt, appError, apiResponse, seed
├── sockets/          # Socket.IO server (real-time)
├── jobs/             # BullMQ workers (notifications, emails)
├── constants/        # Shared enums / cache key builders
└── loaders/          # DB + Redis connection bootstrapping
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+ (local or Atlas)
- Redis 7+ (local or Redis Cloud)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Seed sample data

```bash
npm run seed
```

### 4. Start in development mode

```bash
npm run dev
```

### 5. Start in production

```bash
NODE_ENV=production npm start
```

---

## 🔌 API Reference

Base URL: `http://localhost:5000/api/v1`

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register with email/password |
| POST | `/auth/login` | ❌ | Login → access + refresh tokens |
| POST | `/auth/google` | ❌ | OAuth via Google code |
| POST | `/auth/refresh` | ❌ | Rotate refresh token |
| POST | `/auth/logout` | ✅ | Revoke refresh token |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/:id` | ✅ | Get user profile |
| PUT | `/users/profile` | ✅ | Update own profile |
| GET | `/users/search?query=` | ✅ | Full-text search (cursor paginated) |

### Posts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/posts` | ✅ | Create a post |
| GET | `/posts/feed?cursor=&limit=` | ✅ | Personalised feed (cursor paginated) |
| DELETE | `/posts/:id` | ✅ | Delete own post |

### Comments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/comments` | ✅ | Add comment (supports replies via parentId) |
| GET | `/comments/:postId` | ✅ | Get comments for post |
| DELETE | `/comments/:id` | ✅ | Soft-delete own comment |

### Reactions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/reactions/toggle` | ✅ | Toggle reaction (like/celebrate/support…) |

### Connections

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/connections/send` | ✅ | Send connection request |
| POST | `/connections/respond` | ✅ | Accept or reject request |
| GET | `/connections` | ✅ | List accepted connections |

### Messages

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/messages/:conversationId` | ✅ | Fetch messages (cursor paginated) |
| POST | `/messages` | ✅ | Send a message (also emitted via Socket.IO) |

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | ✅ | Get notifications (cursor paginated) |
| PATCH | `/notifications/read` | ✅ | Mark all as read |

---

## 📡 Socket.IO Events

Connect: `ws://localhost:5000` with `{ auth: { token: '<accessToken>' } }`

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `conversation:join` | `conversationId` | Subscribe to conversation |
| `conversation:leave` | `conversationId` | Unsubscribe |
| `message:send` | `{ conversationId, content, type }` | Send message |
| `typing:start` | `{ conversationId }` | Broadcast typing start |
| `typing:stop` | `{ conversationId }` | Broadcast typing stop |
| `message:read` | `{ conversationId }` | Mark messages as read |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | message object | New message in conversation |
| `typing:start` | `{ conversationId, userId, name }` | User started typing |
| `typing:stop` | `{ conversationId, userId }` | User stopped typing |
| `message:read` | `{ conversationId, userId }` | Read receipt |
| `user:online` | `{ userId }` | User came online |
| `user:offline` | `{ userId, lastSeen }` | User went offline |
| `notification:new` | notification object | Real-time notification push |

---

## 🗄️ MongoDB Schema Design Decisions

| Model | Key Design Choice |
|-------|------------------|
| **User** | Text index on `name + headline` for search; password `select: false` |
| **Post** | Denormalised `reactionsCount` object avoids expensive aggregations |
| **Comment** | Flat with `parentId` (no deep nesting arrays) — scales to millions |
| **Reaction** | Unique compound index `(userId, targetId, targetType)` prevents dupes |
| **Connection** | Compound index both directions; `$inc` on User keeps counts cheap |
| **Message** | Separate `conversationId` doc keeps inbox query O(1) |
| **Notification** | Index on `(userId, isRead, createdAt DESC)` for fast inbox |

---

## ⚡ Scalability Strategies

### Redis Caching
- **User profiles** cached for 15 min (`user:profile:<id>`)
- **Feed first page** cached for 5 min (`feed:<userId>`)
- Cache is busted on profile update or new post

### Socket.IO Horizontal Scaling
- Redis adapter (`@socket.io/redis-adapter`) propagates events across all Node instances
- Each server connects to the same Redis pub/sub channels

### BullMQ Background Jobs
- **Notification queue** — 10 concurrent workers, 3 retries, exponential back-off
- **Email queue** — 5 concurrent workers, 5 retries
- Workers are stateless and can run in separate processes

### MongoDB Indexing
- Compound indexes on all hot query paths
- Text indexes for full-text search
- Sparse indexes for optional unique fields (googleId, phone)
- `createdAt` / `updatedAt` descending indexes for feed pagination

### Avoiding N+1 Queries
- `.populate()` used sparingly and only on necessary fields
- Feed query uses a single aggregated find with `$in` for connections
- `commentsCount` and `reactionsCount` are maintained via `$inc` (no `COUNT(*)`)

---

## 🛡️ Security

- **Helmet** sets secure HTTP headers
- **CORS** locked to `CLIENT_URL`
- **Rate limiting**: 100 req/15 min globally; 10 req/15 min on auth endpoints
- **JWT**: 15-min access tokens + 7-day refresh tokens (hashed in DB)
- **Password hashing**: bcrypt with cost factor 12
- **Input validation**: Joi with `stripUnknown: true` on all endpoints
- **Error handling**: Operational errors leak no stack traces in production

---

## 📅 Day-by-Day Build Roadmap

| Days | Focus | Key Deliverables |
|------|-------|-----------------|
| 1–2 | Project Setup | Folder structure, config, logger, error handler, DB/Redis loaders |
| 3–4 | Auth System | User schema, JWT utils, register/login/refresh/google OAuth |
| 5–6 | User Profiles | Profile CRUD, avatar upload (Cloudinary), search endpoint |
| 7–9 | Post System | Post CRUD, feed aggregation pipeline, Redis feed cache |
| 10–11 | Comments + Reactions | Threaded comments (flat+parentId), reaction toggle, count sync |
| 12–13 | Connections | Send/accept/reject, connection-aware feed filter, count sync |
| 14–16 | Messaging (Socket.IO) | 1:1 chat, typing indicator, read receipts, Redis adapter |
| 17 | Notifications | BullMQ notification queue, real-time push via Socket.IO |
| 18 | Redis Caching | Profile cache, feed cache, cache bust strategy |
| 19 | Optimisation | Index audit, query profiling, N+1 fixes, rate limiter tuning |
| 20 | Deployment | Docker, docker-compose, Nginx config, PM2 cluster, env docs |

---

## 🐳 Docker (Production)

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 5000
CMD ["node", "src/server.js"]
```

```yaml
# docker-compose.yml (abbreviated)
services:
  api:
    build: .
    ports: ["5000:5000"]
    env_file: .env
    depends_on: [mongo, redis]
    deploy:
      replicas: 3        # horizontal scaling

  mongo:
    image: mongo:6
    volumes: [mongo_data:/data/db]

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
```

---

## 🔑 Sample Login Credentials (after seed)

| Email | Password | Role |
|-------|----------|------|
| arjun@example.com | password123 | user |
| priya@example.com | password123 | user |
| rahul@example.com | password123 | user |
| anjali@example.com | password123 | user |
| admin@example.com | adminpass123 | admin |
# LinkedinBackend
