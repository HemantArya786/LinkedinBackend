'use strict';

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getRedisClient, getRedisSubscriber } = require('../loaders/redis');
const { verifyAccessToken } = require('../utils/jwt');
const userRepository = require('../repositories/user.repository');
const { messageService } = require('../services/social.services');
const logger = require('../utils/logger');

/**
 * Initialise Socket.IO on the HTTP server.
 * Uses Redis adapter so events propagate across multiple Node processes.
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: require('../config').clientUrl,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── Redis adapter (horizontal scaling) ──────────────────────────────────────
  const pubClient = getRedisClient();
  const subClient = getRedisSubscriber();
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('Socket.IO Redis adapter attached');

  // ── Middleware: authenticate socket connection ───────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers['authorization']?.split(' ')[1];

      if (!token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      const user = await userRepository.findById(decoded.id);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    logger.debug(`Socket connected: ${userId}`);

    // Put user in their own room (for targeted notifications)
    socket.join(`user:${userId}`);

    // Mark online
    await userRepository.setOnlineStatus(userId, true);
    socket.broadcast.emit('user:online', { userId });

    // ── JOIN CONVERSATION ──────────────────────────────────────────────────────
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // ── SEND MESSAGE ───────────────────────────────────────────────────────────
    socket.on('message:send', async (data, ack) => {
      try {
        const { conversationId, content, type = 'text' } = data;

        const message = await messageService.sendMessage({
          conversationId,
          senderId: userId,
          content,
          type,
        });

        // Broadcast to everyone in the conversation room (including sender)
        io.to(`conv:${conversationId}`).emit('message:new', message);

        if (typeof ack === 'function') ack({ status: 'ok', message });
      } catch (err) {
        logger.error('message:send error', { err });
        if (typeof ack === 'function') ack({ status: 'error', message: err.message });
      }
    });

    // ── TYPING INDICATOR ───────────────────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId,
        name: socket.user.name,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { conversationId, userId });
    });

    // ── READ RECEIPTS ──────────────────────────────────────────────────────────
    socket.on('message:read', async ({ conversationId }) => {
      try {
        await messageService.markRead(conversationId, userId);
        socket.to(`conv:${conversationId}`).emit('message:read', { conversationId, userId });
      } catch (err) {
        logger.error('message:read error', { err });
      }
    });

    // ── REAL-TIME NOTIFICATION PUSH ────────────────────────────────────────────
    // Called from BullMQ notification job; emits to recipient's personal room
    // io.to(`user:${recipientId}`).emit('notification:new', notif)
    // This happens in jobs/notification.job.js

    // ── DISCONNECT ─────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      logger.debug(`Socket disconnected: ${userId}`);
      await userRepository.setOnlineStatus(userId, false);
      socket.broadcast.emit('user:offline', { userId, lastSeen: new Date() });
    });
  });

  return io;
}

module.exports = { initSocket };
