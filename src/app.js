'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middlewares/rateLimiter');
const { mongoSanitize, xssSanitize, hpp, depthGuard } = require('./middlewares/security');
const errorHandler = require('./middlewares/errorHandler');
const v1Routes = require('./routes/v1/index');
const { AppError } = require('./utils/appError');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Security sanitisation
app.use(mongoSanitize);
app.use(xssSanitize);
app.use(hpp);
app.use(depthGuard);

// ── HTTP request logging ──────────────────────────────────────────────────────
if (config.env !== 'test') {
  const morganStream = { write: (msg) => logger.http(msg.trim()) };
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev', { stream: morganStream }));
}

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', env: config.env }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use(`/api/${config.apiVersion}`, v1Routes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.all('*', (req, _res, next) => {
  next(new AppError(`Cannot find ${req.method} ${req.originalUrl}`, 404));
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
