const BranchHistory = require('../models/BranchHistory');
const TestHistory = require('../models/TestHistory');
const PRHistory = require('../models/PRHistory');
const { asyncHandler } = require('../middleware/errorHandler');

const MODEL_MAP = {
  branch: BranchHistory,
  tests: TestHistory,
  pr: PRHistory,
};

/**
 * GET /api/history/:tool
 * Returns paginated history for authenticated user
 */
const getHistory = asyncHandler(async (req, res) => {
  const { tool } = req.params;
  const Model = MODEL_MAP[tool];

  if (!Model) {
    return res.status(400).json({
      success: false,
      message: `Invalid tool. Must be one of: ${Object.keys(MODEL_MAP).join(', ')}`,
    });
  }

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  // Optional search
  const searchQuery = req.query.search ? req.query.search.trim() : '';
  let filter = { userId: req.user._id };

  if (searchQuery) {
    if (tool === 'branch') {
      filter['input.taskDescription'] = { $regex: searchQuery, $options: 'i' };
    } else if (tool === 'tests') {
      filter['input.functionName'] = { $regex: searchQuery, $options: 'i' };
    } else if (tool === 'pr') {
      filter['output.title'] = { $regex: searchQuery, $options: 'i' };
    }
  }

  const [items, total] = await Promise.all([
    Model.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Model.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * DELETE /api/history/:tool/:id
 * Delete a history entry
 */
const deleteHistoryItem = asyncHandler(async (req, res) => {
  const { tool, id } = req.params;
  const Model = MODEL_MAP[tool];

  if (!Model) {
    return res.status(400).json({ success: false, message: 'Invalid tool.' });
  }

  const item = await Model.findOneAndDelete({ _id: id, userId: req.user._id });
  if (!item) {
    return res.status(404).json({ success: false, message: 'History item not found.' });
  }

  res.json({ success: true, message: 'History item deleted.' });
});

/**
 * GET /api/history/dashboard
 * Dashboard summary: recent activity + usage counts
 */
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [branchRecent, testRecent, prRecent] = await Promise.all([
    BranchHistory.find({ userId }).sort({ createdAt: -1 }).limit(3).lean(),
    TestHistory.find({ userId }).sort({ createdAt: -1 }).limit(3).lean(),
    PRHistory.find({ userId }).sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  // Merge and sort recent activity
  const recent = [
    ...branchRecent.map((h) => ({ ...h, tool: 'branch' })),
    ...testRecent.map((h) => ({ ...h, tool: 'tests' })),
    ...prRecent.map((h) => ({ ...h, tool: 'pr' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  res.json({
    success: true,
    data: {
      usageStats: req.user.usageStats,
      dailyUsage: req.user.dailyUsage,
      dailyLimit: parseInt(process.env.DAILY_AI_REQUEST_LIMIT || '20', 10),
      recentActivity: recent,
    },
  });
});

module.exports = { getHistory, deleteHistoryItem, getDashboard };
