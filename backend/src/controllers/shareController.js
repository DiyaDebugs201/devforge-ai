const { nanoid } = require('nanoid');
const BranchHistory = require('../models/BranchHistory');
const TestHistory = require('../models/TestHistory');
const PRHistory = require('../models/PRHistory');
const SharedLink = require('../models/SharedLink');
const { asyncHandler } = require('../middleware/errorHandler');

const MODEL_MAP = {
  branch: { Model: BranchHistory, refModel: 'BranchHistory' },
  tests: { Model: TestHistory, refModel: 'TestHistory' },
  pr: { Model: PRHistory, refModel: 'PRHistory' },
};

/**
 * POST /api/share/:tool/:id
 * Create a shareable public link for a history item
 */
const createShareLink = asyncHandler(async (req, res) => {
  const { tool, id } = req.params;
  const modelInfo = MODEL_MAP[tool];

  if (!modelInfo) {
    return res.status(400).json({ success: false, message: 'Invalid tool.' });
  }

  const { Model, refModel } = modelInfo;

  // Find the history item — must belong to requesting user
  const item = await Model.findOne({ _id: id, userId: req.user._id });
  if (!item) {
    return res.status(404).json({ success: false, message: 'History item not found.' });
  }

  // If already shared, return existing link
  if (item.isShared && item.shareId) {
    const existingLink = await SharedLink.findOne({ shareId: item.shareId, isActive: true });
    if (existingLink) {
      return res.json({
        success: true,
        shareId: item.shareId,
        shareUrl: `${process.env.FRONTEND_URL}/share/${item.shareId}`,
        message: 'Share link already exists.',
      });
    }
  }

  // Generate new share ID
  const shareId = nanoid(12);

  // Create shared link document
  await SharedLink.create({
    shareId,
    tool,
    refId: item._id,
    refModel,
    createdBy: req.user._id,
  });

  // Update history item
  await Model.findByIdAndUpdate(id, { isShared: true, shareId });

  res.status(201).json({
    success: true,
    shareId,
    shareUrl: `${process.env.FRONTEND_URL}/share/${shareId}`,
    message: 'Share link created.',
  });
});

/**
 * GET /api/share/:shareId  (PUBLIC — no auth required)
 * View a shared result
 */
const getSharedItem = asyncHandler(async (req, res) => {
  const { shareId } = req.params;

  const link = await SharedLink.findOne({ shareId, isActive: true }).populate('createdBy', 'name');
  if (!link) {
    return res.status(404).json({ success: false, message: 'Share link not found or has expired.' });
  }

  // Increment view count
  await SharedLink.findByIdAndUpdate(link._id, { $inc: { viewCount: 1 } });

  // Fetch the actual content using the polymorphic reference
  const ModelInfo = MODEL_MAP[link.tool];
  if (!ModelInfo) {
    return res.status(500).json({ success: false, message: 'Invalid tool reference.' });
  }

  const item = await ModelInfo.Model.findById(link.refId).lean();
  if (!item) {
    return res.status(404).json({ success: false, message: 'Original content not found.' });
  }

  res.json({
    success: true,
    data: {
      tool: link.tool,
      content: item,
      sharedBy: link.createdBy?.name || 'Anonymous',
      viewCount: link.viewCount + 1,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
    },
  });
});

/**
 * DELETE /api/share/:tool/:id
 * Revoke a share link
 */
const revokeShareLink = asyncHandler(async (req, res) => {
  const { tool, id } = req.params;
  const ModelInfo = MODEL_MAP[tool];

  if (!ModelInfo) {
    return res.status(400).json({ success: false, message: 'Invalid tool.' });
  }

  const item = await ModelInfo.Model.findOne({ _id: id, userId: req.user._id });
  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found.' });
  }

  if (item.shareId) {
    await SharedLink.findOneAndUpdate({ shareId: item.shareId }, { isActive: false });
    await ModelInfo.Model.findByIdAndUpdate(id, { isShared: false, shareId: null });
  }

  res.json({ success: true, message: 'Share link revoked.' });
});

module.exports = { createShareLink, getSharedItem, revokeShareLink };
