const mongoose = require('mongoose');

const branchOptionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  prefix: { type: String, required: true },
  fullCommand: { type: String, required: true }, // git checkout -b feature/PROJ-123-fix-login
}, { _id: false });

const branchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    input: {
      taskDescription: { type: String, required: true, maxlength: 500 },
      ticketId: { type: String, default: '' }, // e.g. PROJ-123
    },
    branches: [branchOptionSchema],
    selectedBranch: { type: String, default: null }, // which one the user copied
    shareId: { type: String, default: null, index: true, sparse: true },
    isShared: { type: Boolean, default: false },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

branchHistorySchema.index({ userId: 1, createdAt: -1 });
branchHistorySchema.index({ shareId: 1 });

module.exports = mongoose.model('BranchHistory', branchHistorySchema);
