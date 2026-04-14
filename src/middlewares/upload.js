'use strict';

const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { AppError } = require('../utils/appError');
const config = require('../config');

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// Use memory storage so we stream buffer to Cloudinary directly
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError(`Unsupported file type: ${file.mimetype}`, 400));
};

/** General upload (up to 5 files, 10 MB each) */
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/**
 * Upload a single buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} folder  - e.g. 'profiles', 'posts'
 * @param {string} [publicId]
 * @returns {Promise<{url: string, publicId: string, type: string}>}
 */
async function uploadToCloudinary(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `linkedin/${folder}`,
        public_id: publicId,
        resource_type: 'auto',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err) return reject(new AppError(`Cloudinary upload failed: ${err.message}`, 500));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          type: result.resource_type === 'video' ? 'video' : 'image',
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary by publicId.
 */
async function deleteFromCloudinary(publicId, resourceType = 'image') {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    // Non-fatal: log but don't crash
    require('../utils/logger').warn(`Cloudinary delete failed for ${publicId}`, { err });
  }
}

module.exports = { upload, uploadToCloudinary, deleteFromCloudinary };
