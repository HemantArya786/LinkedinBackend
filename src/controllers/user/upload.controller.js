'use strict';

const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../../middlewares/upload');
const userRepository = require('../../repositories/user.repository');
const { cache } = require('../../loaders/redis');
const { sendSuccess } = require('../../utils/apiResponse');
const { asyncHandler, AppError } = require('../../utils/appError');

/**
 * POST /api/v1/users/profile-image
 * Middleware chain:  upload.single('image') → uploadProfileImage
 */
const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image file provided', 400);

  const userId = req.user._id;
  const currentUser = await userRepository.findById(userId);

  // Delete old image from Cloudinary
  if (currentUser?.profileImage?.publicId) {
    await deleteFromCloudinary(currentUser.profileImage.publicId);
  }

  const result = await uploadToCloudinary(req.file.buffer, 'profiles', `profile_${userId}`);

  const user = await userRepository.updateById(userId, { profileImage: result });
  await cache.del(`user:profile:${userId}`);

  sendSuccess(res, { user });
});

/**
 * POST /api/v1/users/cover-image
 */
const uploadCoverImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image file provided', 400);

  const userId = req.user._id;
  const currentUser = await userRepository.findById(userId);

  if (currentUser?.coverImage?.publicId) {
    await deleteFromCloudinary(currentUser.coverImage.publicId);
  }

  const result = await uploadToCloudinary(req.file.buffer, 'covers', `cover_${userId}`);
  const user = await userRepository.updateById(userId, { coverImage: result });
  await cache.del(`user:profile:${userId}`);

  sendSuccess(res, { user });
});

/**
 * POST /api/v1/posts/media
 * Upload up to 4 files for a post and return their Cloudinary URLs.
 * The client then includes these URLs when calling POST /posts.
 */
const uploadPostMedia = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('No files provided', 400);
  }

  const uploads = await Promise.all(
    req.files.map((f) => uploadToCloudinary(f.buffer, 'posts'))
  );

  sendSuccess(res, { media: uploads });
});

module.exports = {
  upload,
  uploadProfileImage,
  uploadCoverImage,
  uploadPostMedia,
};
