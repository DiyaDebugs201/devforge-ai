const mongoose = require('mongoose');

const sharedLinkSchema = new mongoose.Schema(
  {
    shareId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tool: {
      type: String,
      enum: ['branch', 'tests', 'pr'],
      required: true,
    },
    // Polymorphic reference
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    refModel: {
      type: String,
      enum: ['BranchHistory', 'TestHistory', 'PRHistory'],
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewCount: { type: Number, default: 0 },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes expired links
sharedLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SharedLink', sharedLinkSchema);
