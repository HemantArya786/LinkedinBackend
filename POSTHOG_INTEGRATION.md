# PostHog Analytics Integration

This document describes the PostHog analytics integration implemented in the LinkedIn Backend application.

## Overview

PostHog is a product analytics platform that tracks user behavior and events. The integration enables monitoring of:
- User registration and authentication
- Post creation and deletion
- User interactions (comments, reactions, connections)
- Messaging activity

## Configuration

### 1. Set Environment Variables

Add these to your `.env` file:

```bash
# PostHog API Key (get from https://app.posthog.com/settings/team/general)
POSTHOG_API_KEY=phc_your_key_here

# PostHog API URL (defaults to https://app.posthog.com)
POSTHOG_API_URL=https://app.posthog.com
```

### 2. Initialize PostHog

PostHog is automatically initialized on server startup in `src/server.js`. If the `POSTHOG_API_KEY` is not configured, analytics is gracefully disabled with a warning.

## Tracked Events

### Authentication Events

| Event | Properties | Description |
|-------|-----------|-------------|
| `user_registered` | `email`, `method` | User creates account (email or OAuth) |
| `user_logged_in` | `method` | User logs in |
| `user_logged_out` | — | User logs out |
| `google_linked` | `email` | User links Google account |

### Content Events

| Event | Properties | Description |
|-------|-----------|-------------|
| `post_created` | `post_id`, `has_image`, `has_video` | User creates a post |
| `post_deleted` | `post_id` | User deletes a post |
| `comment_created` | `post_id`, `is_reply` | User adds a comment |

### Engagement Events

| Event | Properties | Description |
|-------|-----------|-------------|
| `reaction_added` | `reaction_type`, `target_type` | User likes/reacts to content |
| `reaction_changed` | `from_type`, `to_type`, `target_type` | User changes reaction type |
| `reaction_removed` | `reaction_type`, `target_type` | User removes reaction |

### Social Events

| Event | Properties | Description |
|-------|-----------|-------------|
| `connection_requested` | `receiver_id` | User sends connection request |
| `connection_accepted` | `sender_id` | User accepts connection |
| `connection_rejected` | `sender_id` | User rejects connection |
| `message_sent` | `message_type`, `conversation_id` | User sends message |

## Architecture

### Loader (`src/loaders/posthog.js`)

Provides utility functions for analytics:

```javascript
const { captureEvent, identifyUser, shutdownPostHog } = require('../loaders/posthog');

// Track an event
captureEvent(userId, 'user_registered', { email: user.email });

// Identify a user with properties
identifyUser(userId, { email, name, signed_up_at });

// Graceful shutdown (called on server exit)
await shutdownPostHog();
```

### Integration Points

1. **Authentication Service** (`src/services/auth.service.js`)
   - Tracks registration, login, logout, OAuth events

2. **Post Service** (`src/services/post.service.js`)
   - Tracks post creation and deletion

3. **Social Services** (`src/services/social.services.js`)
   - Tracks comments, reactions, connections, messages

4. **Server** (`src/server.js`)
   - Initializes PostHog on startup
   - Calls `shutdownPostHog()` during graceful shutdown

## Environment Behavior

- **Production**: Events are flushed every 10 seconds
- **Development**: Same behavior; all events are tracked
- **Test**: PostHog is disabled (no API key needed for tests)
- **Missing API Key**: Analytics silently disabled with warning log

## Usage Example

```javascript
// In any service
const { captureEvent, identifyUser } = require('../loaders/posthog');

// Track an event
captureEvent(userId.toString(), 'custom_event', {
  custom_property: 'value',
});

// Identify user with properties
identifyUser(userId.toString(), {
  email: user.email,
  plan: 'premium',
});
```

## Debugging

To check if PostHog is initialized:

```bash
# View server logs on startup
npm run dev

# Should see: ✅  PostHog initialized
```

To verify events are being sent:

1. Go to PostHog dashboard: https://app.posthog.com
2. Navigate to Events tab
3. Filter by your event names
4. Check that events appear with correct properties

## Performance Considerations

- Events are queued and flushed in batches every 10 seconds
- Event capture is non-blocking (errors are caught and logged)
- PostHog gracefully shuts down when server exits
- No impact if POSTHOG_API_KEY is not configured

## Future Enhancements

Potential events to add:
- `profile_updated` - Track profile modifications
- `feed_viewed` - Track feed engagement
- `search_performed` - Track search behavior
- `media_uploaded` - Track file uploads
- `error_occurred` - Track client/server errors

