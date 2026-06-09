const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  name: { type: String, required: true },         // e.g. "should return null when input is empty"
  category: {
    type: String,
    enum: ['happy-path', 'edge-case', 'error', 'boundary'],
    required: true,
  },
  code: { type: String, required: true },         // individual test block code
}, { _id: false });

const testHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    input: {
      functionCode: { type: String, required: true }, // original pasted function
      language: { type: String, enum: ['javascript', 'typescript'], default: 'javascript' },
      functionName: { type: String, default: '' },    // extracted function name
    },
    output: {
      fullTestFile: { type: String, required: true }, // complete Jest test file
      testCases: [testCaseSchema],
      estimatedCoverage: { type: Number, min: 0, max: 100, default: 0 }, // percentage
      importStatement: { type: String, default: '' }, // e.g. import { myFn } from './myFn'
    },
    shareId: { type: String, default: null, index: true, sparse: true },
    isShared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

testHistorySchema.index({ userId: 1, createdAt: -1 });
testHistorySchema.index({ shareId: 1 });

module.exports = mongoose.model('TestHistory', testHistorySchema);
