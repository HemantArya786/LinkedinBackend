'use strict';

/**
 * src/jobs/cron.js
 * Scheduled background tasks using native setInterval + a simple cron-like wrapper.
 *
 * For production, replace with:
 *   - node-cron (lightweight)
 *   - Agenda (MongoDB-backed, persistent)
 *   - BullMQ Repeat jobs (already used)
 *
 * Tasks:
 *   1. Daily notification digest email (9 AM)
 *   2. Cleanup expired/soft-deleted records (2 AM)
 *   3. Refresh platform stats cache (every 10 min)
 *   4. Session token cleanup (every hour)
 */

const logger = require('../utils/logger');
const { cache } = require('../loaders/redis');
const { enqueueEmail } = require('./index');

// ── Simple scheduler ──────────────────────────────────────────────────────────
function scheduleDaily(hour, fn, label) {
  const msUntilNext = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  };

  const run = async () => {
    try {
      logger.info(`[CRON] Running: ${label}`);
      await fn();
      logger.info(`[CRON] Completed: ${label}`);
    } catch (err) {
      logger.error(`[CRON] Failed: ${label}`, { err });
    }
    setTimeout(run, msUntilNext());
  };

  setTimeout(run, msUntilNext());
  logger.info(`[CRON] Scheduled "${label}" at ${hour}:00 daily`);
}

function scheduleInterval(intervalMs, fn, label) {
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      logger.error(`[CRON] Interval task failed: ${label}`, { err });
    }
  };
  setInterval(run, intervalMs);
  logger.info(`[CRON] Scheduled "${label}" every ${intervalMs / 1000}s`);
}

// ── Task 1: Daily notification digest (9 AM) ──────────────────────────────────
async function sendNotificationDigests() {
  const User = require('../models/User');
  const { Notification } = require('../models/index');
  const { welcomeEmail } = require('../utils/emailTemplates');

  // Find users with unread notifications
  const usersWithUnread = await Notification.distinct('userId', { isRead: false });

  for (const userId of usersWithUnread) {
    const user = await User.findById(userId).select('name email').lean();
    if (!user) continue;

    const count = await Notification.countDocuments({ userId, isRead: false });

    await enqueueEmail({
      to: user.email,
      subject: `You have ${count} unread notification${count > 1 ? 's' : ''}`,
      html: `
        <p>Hi ${user.name},</p>
        <p>You have <strong>${count}</strong> unread notification${count > 1 ? 's' : ''} waiting for you.</p>
        <p><a href="${process.env.CLIENT_URL}/notifications">View Notifications</a></p>
      `,
    });
  }

  logger.info(`[CRON] Digest emails queued for ${usersWithUnread.length} users`);
}

// ── Task 2: Cleanup soft-deleted comments older than 30 days (2 AM) ───────────
async function cleanupSoftDeleted() {
  const { Comment } = require('../models/index');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { deletedCount } = await Comment.deleteMany({
    isDeleted: true,
    updatedAt: { $lt: thirtyDaysAgo },
  });

  logger.info(`[CRON] Cleaned up ${deletedCount} soft-deleted comments`);
}

// ── Task 3: Bust admin stats cache (every 10 min) ─────────────────────────────
async function refreshStatsCache() {
  await cache.del('admin:stats');
  logger.debug('[CRON] Admin stats cache busted');
}

// ── Task 4: Cleanup stale refresh tokens (every hour) ─────────────────────────
async function cleanupRefreshTokens() {
  // Users with more than 10 stored tokens (they forgot to logout across devices)
  // Keep only the 5 most recently added.
  const User = require('../models/User');

  const users = await User.find({
    $expr: { $gt: [{ $size: '$refreshTokens' }, 10] },
  })
    .select('+refreshTokens')
    .lean();

  for (const user of users) {
    const trimmed = user.refreshTokens.slice(-5); // keep last 5
    await User.findByIdAndUpdate(user._id, { refreshTokens: trimmed });
  }

  if (users.length > 0) {
    logger.info(`[CRON] Trimmed refresh tokens for ${users.length} users`);
  }
}

// ── Bootstrap: register all cron jobs ─────────────────────────────────────────
function startCronJobs() {
  scheduleDaily(9,  sendNotificationDigests, 'Notification digest');
  scheduleDaily(2,  cleanupSoftDeleted,      'Soft-delete cleanup');
  scheduleInterval(10 * 60 * 1000, refreshStatsCache,      'Stats cache refresh');
  scheduleInterval(60 * 60 * 1000, cleanupRefreshTokens,   'Refresh token cleanup');

  logger.info('[CRON] All cron jobs registered');
}

module.exports = { startCronJobs };
