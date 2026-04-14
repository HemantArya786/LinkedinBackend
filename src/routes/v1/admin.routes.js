'use strict';

const { Router } = require('express');
const adminRouter = Router();

const adminCtrl = require('../../controllers/admin/admin.controller');
const { protect, restrictTo } = require('../../middlewares/auth');

// All admin routes require authentication + admin role
adminRouter.use(protect, restrictTo('admin'));

adminRouter.get('/stats',               adminCtrl.getPlatformStats);
adminRouter.get('/users',               adminCtrl.listUsers);
adminRouter.get('/users/:id',           adminCtrl.getUserDetail);
adminRouter.put('/users/:id/role',      adminCtrl.changeUserRole);
adminRouter.delete('/users/:id',        adminCtrl.deleteUser);
adminRouter.get('/posts',               adminCtrl.listPosts);
adminRouter.delete('/posts/:id',        adminCtrl.adminDeletePost);

module.exports = adminRouter;
