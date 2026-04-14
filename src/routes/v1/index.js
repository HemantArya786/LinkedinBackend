'use strict';

const { Router } = require('express');
const router = Router();

// ── Controllers ────────────────────────────────────────────────────────────────
const authCtrl   = require('../../controllers/auth/auth.controller');
const userCtrl   = require('../../controllers/user/user.controller');
const uploadCtrl = require('../../controllers/user/upload.controller');
const postCtrl   = require('../../controllers/post/post.controller');
const socialCtrl = require('../../controllers/social/social.controller');

// ── Middlewares ────────────────────────────────────────────────────────────────
const { protect }     = require('../../middlewares/auth');
const { authLimiter } = require('../../middlewares/rateLimiter');
const { upload }      = require('../../middlewares/upload');

// ── Validators ─────────────────────────────────────────────────────────────────
const {
  validate,
  registerSchema,
  loginSchema,
  refreshSchema,
  createPostSchema,
  createCommentSchema,
  sendConnectionSchema,
  respondConnectionSchema,
  sendMessageSchema,
  updateProfileSchema,
} = require('../../validators/index');

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH  /api/v1/auth
// ═══════════════════════════════════════════════════════════════════════════════
const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), authCtrl.register);
authRouter.post('/login',    authLimiter, validate(loginSchema),    authCtrl.login);
authRouter.post('/google',   authLimiter,                           authCtrl.googleAuth);
authRouter.post('/refresh',               validate(refreshSchema),  authCtrl.refresh);
authRouter.post('/logout',   protect,                               authCtrl.logout);

// ═══════════════════════════════════════════════════════════════════════════════
// USERS  /api/v1/users
// ═══════════════════════════════════════════════════════════════════════════════
const userRouter = Router();

userRouter.get('/search',          protect,                                userCtrl.searchUsers);
userRouter.get('/:id',             protect,                                userCtrl.getProfile);
userRouter.put('/profile',         protect, validate(updateProfileSchema), userCtrl.updateProfile);
userRouter.post('/profile-image',  protect, upload.single('image'),        uploadCtrl.uploadProfileImage);
userRouter.post('/cover-image',    protect, upload.single('image'),        uploadCtrl.uploadCoverImage);

// ═══════════════════════════════════════════════════════════════════════════════
// POSTS  /api/v1/posts
// ═══════════════════════════════════════════════════════════════════════════════
const postRouter = Router();

postRouter.post('/media',  protect, upload.array('media', 4), uploadCtrl.uploadPostMedia);
postRouter.post('/',       protect, validate(createPostSchema), postCtrl.createPost);
postRouter.get('/feed',    protect,                             postCtrl.getFeed);
postRouter.delete('/:id',  protect,                             postCtrl.deletePost);

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENTS  /api/v1/comments
// ═══════════════════════════════════════════════════════════════════════════════
const commentRouter = Router();

commentRouter.post('/',          protect, validate(createCommentSchema), socialCtrl.createComment);
commentRouter.get('/:postId',    protect,                                socialCtrl.getComments);
commentRouter.delete('/:id',     protect,                                socialCtrl.deleteComment);

// ═══════════════════════════════════════════════════════════════════════════════
// REACTIONS  /api/v1/reactions
// ═══════════════════════════════════════════════════════════════════════════════
const reactionRouter = Router();

reactionRouter.post('/toggle', protect, socialCtrl.toggleReaction);

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTIONS  /api/v1/connections
// ═══════════════════════════════════════════════════════════════════════════════
const connectionRouter = Router();

connectionRouter.post('/send',    protect, validate(sendConnectionSchema),    socialCtrl.sendConnectionRequest);
connectionRouter.post('/respond', protect, validate(respondConnectionSchema), socialCtrl.respondToConnection);
connectionRouter.get('/',         protect,                                     socialCtrl.getConnections);

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES  /api/v1/messages
// ═══════════════════════════════════════════════════════════════════════════════
const messageRouter = Router();

messageRouter.get('/:conversationId', protect,                              socialCtrl.getMessages);
messageRouter.post('/',               protect, validate(sendMessageSchema), socialCtrl.sendMessage);

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS  /api/v1/notifications
// ═══════════════════════════════════════════════════════════════════════════════
const notificationRouter = Router();

notificationRouter.get('/',         protect, socialCtrl.getNotifications);
notificationRouter.patch('/read',   protect, socialCtrl.markNotificationsRead);

// ═══════════════════════════════════════════════════════════════════════════════
// Mount all sub-routers on /api/v1
// ═══════════════════════════════════════════════════════════════════════════════
router.use('/auth',          authRouter);
router.use('/users',         userRouter);
router.use('/posts',         postRouter);
router.use('/comments',      commentRouter);
router.use('/reactions',     reactionRouter);
router.use('/connections',   connectionRouter);
router.use('/messages',      messageRouter);
router.use('/notifications', notificationRouter);

module.exports = router;

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN  /api/v1/admin
// ═══════════════════════════════════════════════════════════════════════════════
const adminRouter = require('./admin.routes');
router.use('/admin', adminRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH  /api/v1/search
// CONVERSATIONS  /api/v1/conversations
// ═══════════════════════════════════════════════════════════════════════════════
const { searchRouter, conversationRouter } = require('./extras.routes');
router.use('/search', searchRouter);
router.use('/conversations', conversationRouter);
