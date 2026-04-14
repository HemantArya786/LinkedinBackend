# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy manifests first for better layer caching
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:18-alpine AS runtime

# Add a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package.json ./

# Create log directory with correct ownership
RUN mkdir -p logs && chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

# Use tini as PID 1 for proper signal handling
# Install: apk add --no-cache tini
ENTRYPOINT ["node"]
CMD ["src/server.js"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1
