'use strict';

// Re-export so other services can import notification independently
const { notificationService } = require('./social.services');
module.exports = notificationService;
