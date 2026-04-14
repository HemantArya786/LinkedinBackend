/**
 * socket-client-example.js
 * ─────────────────────────
 * Shows how a frontend JavaScript client connects to the Socket.IO server
 * and uses all real-time features: messaging, typing, presence, notifications.
 *
 * Install socket.io-client:  npm install socket.io-client
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:5000';
const ACCESS_TOKEN = 'YOUR_JWT_ACCESS_TOKEN_HERE'; // obtained from /auth/login

// ── 1. Connect ────────────────────────────────────────────────────────────────
const socket = io(SERVER_URL, {
  auth: { token: ACCESS_TOKEN },
  transports: ['websocket'],   // prefer WS over long-polling
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('✅  Connected:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.warn('Disconnected:', reason);
});

// ── 2. Presence ───────────────────────────────────────────────────────────────
socket.on('user:online',  ({ userId })            => console.log(`🟢 ${userId} is online`));
socket.on('user:offline', ({ userId, lastSeen })  => console.log(`🔴 ${userId} offline at ${lastSeen}`));

// ── 3. Join a conversation ────────────────────────────────────────────────────
const conversationId = 'CONV_OBJECT_ID_HERE';

socket.emit('conversation:join', conversationId);
console.log(`Joined conversation: ${conversationId}`);

// ── 4. Send a message ─────────────────────────────────────────────────────────
socket.emit(
  'message:send',
  { conversationId, content: 'Hey! How are you?', type: 'text' },
  (ack) => {
    if (ack.status === 'ok') {
      console.log('Message sent:', ack.message._id);
    } else {
      console.error('Send failed:', ack.message);
    }
  }
);

// ── 5. Receive new messages ───────────────────────────────────────────────────
socket.on('message:new', (message) => {
  console.log(`New message from ${message.senderId.name}: ${message.content}`);
});

// ── 6. Typing indicator ───────────────────────────────────────────────────────
// Emit typing:start when user begins typing
const startTyping = () => socket.emit('typing:start', { conversationId });
const stopTyping  = () => socket.emit('typing:stop',  { conversationId });

// Listen for the other party typing
socket.on('typing:start', ({ userId, name }) => {
  console.log(`${name} is typing…`);
});

socket.on('typing:stop', ({ userId }) => {
  console.log(`${userId} stopped typing`);
});

// ── 7. Read receipts ──────────────────────────────────────────────────────────
// Mark messages as read when conversation is opened
socket.emit('message:read', { conversationId });

socket.on('message:read', ({ userId }) => {
  console.log(`${userId} read the messages`);
});

// ── 8. Real-time notifications ────────────────────────────────────────────────
socket.on('notification:new', (notification) => {
  console.log(`🔔 Notification [${notification.type}]: ${notification.message}`);
  // Update notification badge in UI
});

// ── 9. Leave conversation (e.g. when navigating away) ─────────────────────────
const leaveConversation = () => socket.emit('conversation:leave', conversationId);

// ── 10. Disconnect cleanly ────────────────────────────────────────────────────
const disconnect = () => socket.disconnect();

module.exports = { socket, startTyping, stopTyping, leaveConversation, disconnect };
