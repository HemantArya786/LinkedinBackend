'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String },          // Cloudinary public_id for deletion
    type: { type: String, enum: ['image', 'video'], default: 'image' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,   // allow multiple null values
    },
    password: {
      type: String,
      select: false,  // never returned by default
      minlength: 6,
    },

    // ── OAuth ───────────────────────────────────────────────────
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },

    // ── Media ───────────────────────────────────────────────────
    profileImage: mediaSchema,
    coverImage: mediaSchema,

    // ── Profile ─────────────────────────────────────────────────
    headline: { type: String, maxlength: 220 },
    bio: { type: String, maxlength: 2600 },
    interests: [{ type: String, maxlength: 50 }],

    // ── Social graph (denormalised counter – updated via inc) ───
    connectionsCount: { type: Number, default: 0, min: 0 },

    // ── Presence ────────────────────────────────────────────────
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    // ── Access control ──────────────────────────────────────────
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // ── Tokens ──────────────────────────────────────────────────
    refreshTokens: { type: [String], select: false }, // store hashed tokens
  },
  {
    timestamps: true,   // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// Text index for full-text search on name + headline
userSchema.index({ name: 'text', headline: 'text' });
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ isOnline: 1 });
userSchema.index({ createdAt: -1 });

// ── Pre-save hook: hash password ──────────────────────────────────────────────
userSchema.pre('save', async function hashPasswordHook(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare password ────────────────────────────────────────
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Static: safe public projection ───────────────────────────────────────────
userSchema.statics.publicFields =
  'name email headline bio profileImage coverImage connectionsCount isOnline lastSeen';

module.exports = mongoose.model('User', userSchema);
