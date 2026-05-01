'use strict';

const PostHog = require('posthog-node').default;
const config = require('../config');
const logger = require('../utils/logger');

let posthogClient = null;

/**
 * Initialize PostHog analytics client
 */
function initPostHog() {
  if (!config.posthog.apiKey) {
    logger.warn('PostHog API key not configured. Analytics disabled.');
    return null;
  }

  try {
    posthogClient = new PostHog(config.posthog.apiKey, {
      apiUrl: config.posthog.apiUrl,
      flushInterval: 10000, // Flush events every 10s
    });

    logger.info('✅  PostHog initialized');
    return posthogClient;
  } catch (err) {
    logger.error('Failed to initialize PostHog', { err });
    return null;
  }
}

/**
 * Get PostHog client instance
 */
function getPostHogClient() {
  return posthogClient;
}

/**
 * Capture an event
 */
function captureEvent(distinctId, event, properties = {}) {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        env: config.env,
      },
    });
  } catch (err) {
    logger.error('PostHog capture error', { event, err });
  }
}

/**
 * Identify a user
 */
function identifyUser(distinctId, properties = {}) {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.identify({
      distinctId,
      properties: {
        ...properties,
        identified_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('PostHog identify error', { distinctId, err });
  }
}

/**
 * Gracefully shutdown PostHog
 */
async function shutdownPostHog() {
  if (!posthogClient) {
    return;
  }

  try {
    await posthogClient.shutdown();
    logger.info('PostHog shut down gracefully');
  } catch (err) {
    logger.error('Error shutting down PostHog', { err });
  }
}

module.exports = {
  initPostHog,
  getPostHogClient,
  captureEvent,
  identifyUser,
  shutdownPostHog,
};
