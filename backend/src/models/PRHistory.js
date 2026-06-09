const mongoose = require('mongoose');

const prHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    input: {
      type: { type: String, enum: ['diff', 'url'], required: true },
      rawDiff: { type: String, default: '' },      // pasted git diff
      prUrl: { type: String, default: '' },        // GitHub PR URL
    },
    output: {
      title: { type: String, required: true },
      summary: { type: String, required: true },
      whatChanged: { type: String, required: true },
      whyChanged: { type: String, required: true },
      testingSteps: { type: String, required: true },
      reviewerChecklist: [{ type: String }],
      markdownFull: { type: String, required: true },  // full markdown version
      plainTextFull: { type: String, required: true },  // full plain text version
    },
    mode: { type: String, enum: ['concise', 'detailed'], default: 'concise' },
    shareId: { type: String, default: null, index: true, sparse: true },
    isShared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

prHistorySchema.index({ userId: 1, createdAt: -1 });
prHistorySchema.index({ shareId: 1 });

module.exports = mongoose.model('PRHistory', prHistorySchema);
