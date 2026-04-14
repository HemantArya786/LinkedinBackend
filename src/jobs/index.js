'use strict';

const { Queue, Worker, QueueEvents } = require('bullmq');
const { getRedisClient } = require('../loaders/redis');
const logger = require('../utils/logger');
const config = require('../config');

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

// ─── NOTIFICATION QUEUE ───────────────────────────────────────────────────────

const notificationQueue = new Queue('notifications', { connection });

/**
 * Add a notification job.
 * @param {object} payload - { userId, type, actorId, referenceId, referenceType, message }
 */
async function enqueueNotification(payload) {
  await notificationQueue.add('send-notification', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

// ─── EMAIL QUEUE ──────────────────────────────────────────────────────────────

const emailQueue = new Queue('emails', { connection });

async function enqueueEmail(payload) {
  await emailQueue.add('send-email', payload, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  });
}

// ─── WORKERS ──────────────────────────────────────────────────────────────────

let io; // will be set via setIO()

function setIO(socketServer) {
  io = socketServer;
}

/**
 * Notification worker:
 *  1. Persists notification to DB
 *  2. Pushes real-time event to user's socket room
 */
const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { notificationService } = require('../services/social.services');
    const notif = await notificationService.create(job.data);

    // Real-time push (if socket server is available)
    if (io) {
      io.to(`user:${job.data.userId}`).emit('notification:new', notif);
    }
    logger.debug('Notification sent', { notif });
  },
  { connection, concurrency: 10 }
);

/**
 * Email worker – uses Nodemailer.
 */
const emailWorker = new Worker(
  'emails',
  async (job) => {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      auth: { user: config.email.user, pass: config.email.pass },
    });

    const { to, subject, html } = job.data;
    await transporter.sendMail({ from: config.email.from, to, subject, html });
    logger.debug(`Email sent to ${to}`);
  },
  { connection, concurrency: 5 }
);

// ── Worker error logging ──────────────────────────────────────────────────────
[notificationWorker, emailWorker].forEach((w) => {
  w.on('failed', (job, err) => {
    logger.error(`Worker job failed: ${job?.name}`, { err });
  });
});

module.exports = {
  notificationQueue,
  emailQueue,
  enqueueNotification,
  enqueueEmail,
  setIO,
};
