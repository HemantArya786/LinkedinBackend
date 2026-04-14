# Contributing Guide

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 6+ running locally (`brew services start mongodb-community`)
- Redis 7+ running locally (`brew services start redis`)

### First-time setup

```bash
git clone https://github.com/your-org/linkedin-backend.git
cd linkedin-backend
npm install
cp .env.example .env          # Fill in your values
npm run seed                   # Seed sample data
npm run dev                    # Start dev server with hot reload
```

---

## Project Structure

```
src/
├── config/         ← Single env config (NEVER use process.env elsewhere)
├── controllers/    ← HTTP layer only: parse req, call service, send res
├── services/       ← Business logic, no HTTP concerns
├── repositories/   ← DB queries only, no business logic
├── models/         ← Mongoose schemas + indexes
├── routes/v1/      ← Express routers
├── middlewares/    ← auth, errors, validation, security
├── validators/     ← Joi schemas
├── sockets/        ← Socket.IO event handlers
├── jobs/           ← BullMQ queues/workers + cron
├── utils/          ← Shared helpers (logger, jwt, apiResponse, etc.)
├── loaders/        ← DB + Redis connection setup
└── constants/      ← Shared enums, cache key builders
```

---

## Architecture Rules

### 1. Strict layering — never skip layers

```
Route → Controller → Service → Repository → MongoDB/Redis
```

- Controllers **must not** query the DB directly
- Services **must not** access `req` / `res`
- Repositories **must not** contain business logic

### 2. Always use `asyncHandler`

```js
// ✅ Correct
router.get('/foo', protect, asyncHandler(async (req, res) => {
  const data = await fooService.get(req.params.id);
  sendSuccess(res, { data });
}));

// ❌ Wrong — unhandled rejection crashes the process
router.get('/foo', async (req, res) => { ... });
```

### 3. Always throw `AppError`, never raw `Error`

```js
// ✅
throw new AppError('User not found', 404);

// ❌
throw new Error('User not found');
res.status(404).json({ error: 'User not found' });
```

### 4. Cache invalidation is the caller's responsibility

When a service modifies data, it must bust the relevant cache keys:

```js
await userRepository.updateById(id, updates);
await cache.del(`user:profile:${id}`);  // ← bust immediately after write
```

### 5. Use `.lean()` for read-only queries

```js
// ✅ 3-5x faster for reads
await Post.find(filter).lean();

// ❌ Unnecessary Mongoose document overhead for reads
await Post.find(filter);
```

---

## Adding a New Feature

**Example: adding a "Save Post" (bookmark) feature**

1. **Model** — add `Bookmark` schema to `src/models/index.js`
2. **Repository** — create `src/repositories/bookmark.repository.js`
3. **Service** — create `src/services/bookmark.service.js`
4. **Controller** — create `src/controllers/post/bookmark.controller.js`
5. **Route** — add to `src/routes/v1/index.js`
6. **Validator** — add Joi schema to `src/validators/index.js`
7. **Test** — add `__tests__/bookmark.test.js`

---

## Running Tests

```bash
npm test                  # Run all tests once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

Tests use:
- **mongodb-memory-server** — isolated in-memory MongoDB (no real DB needed)
- **Redis mocked** — `__tests__/setup.js` mocks all Redis calls
- **supertest** — HTTP integration tests against the Express app

---

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(post): add bookmark endpoint
fix(auth): handle expired refresh token edge case
refactor(feed): switch to fan-out-on-write strategy
test(connection): add mutual connections count test
docs(readme): update Socket.IO event table
```

---

## Pull Request Process

1. Branch from `develop`: `git checkout -b feat/your-feature`
2. Write tests for new functionality
3. Ensure `npm run lint:check` passes
4. Ensure `npm test` passes with coverage > 70%
5. Open PR against `develop`
6. At least 1 review required before merge to `main`

---

## Environment Variables

All env vars are documented in `.env.example`. The config is centralised in `src/config/index.js` — never read `process.env` directly in application code.

---

## Useful Commands

```bash
npm run dev          # Dev server (nodemon)
npm run seed         # Reset DB + seed sample data
npm run lint         # Auto-fix linting issues
npm run load-test    # Run Artillery load test (server must be running)
npm run docker:up    # Start full stack via Docker Compose
npm run pm2:start    # Start in production (PM2 cluster)
```
