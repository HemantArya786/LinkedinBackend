'use strict';

module.exports = {
  // Reaction types
  REACTION_TYPES: ['like', 'celebrate', 'support', 'insightful', 'funny'],

  // Post visibility
  VISIBILITY: { PUBLIC: 'public', CONNECTIONS: 'connections' },

  // Connection status
  CONNECTION_STATUS: { PENDING: 'pending', ACCEPTED: 'accepted', REJECTED: 'rejected' },

  // Notification types
  NOTIFICATION_TYPES: {
    LIKE: 'like',
    COMMENT: 'comment',
    CONNECTION_REQUEST: 'connection_request',
    CONNECTION_ACCEPTED: 'connection_accepted',
    MESSAGE: 'message',
    MENTION: 'mention',
  },

  // Message types
  MESSAGE_TYPES: { TEXT: 'text', IMAGE: 'image', GIF: 'gif', LINK: 'link' },

  // User roles
  ROLES: { USER: 'user', ADMIN: 'admin' },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  // Redis cache keys (use functions to avoid key collisions)
  CACHE_KEYS: {
    userProfile: (id) => `user:profile:${id}`,
    userFeed: (id) => `feed:${id}`,
    postDetail: (id) => `post:${id}`,
  },
};
