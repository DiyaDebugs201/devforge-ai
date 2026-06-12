const User = require('../models/User');
const BranchHistory = require('../models/BranchHistory');
const TestHistory = require('../models/TestHistory');
const PRHistory = require('../models/PRHistory');
const SharedLink = require('../models/SharedLink');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/admin/stats
 * Platform-wide usage statistics — admin only
 */
const getPlatformStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsersToday,
    totalBranch,
    totalTests,
    totalPR,
    totalSharedLinks,
    recentUsers,
    topUsers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({
      'dailyUsage.date': new Date().toISOString().split('T')[0],
      'dailyUsage.count': { $gt: 0 },
    }),
    BranchHistory.countDocuments(),
    TestHistory.countDocuments(),
    PRHistory.countDocuments(),
    SharedLink.countDocuments({ isActive: true }),
    User.find().sort({ createdAt: -1 }).limit(10).select('name email role createdAt usageStats').lean(),
    User.aggregate([
      {
        $addFields: {
          totalUsage: {
            $add: ['$usageStats.branch', '$usageStats.tests', '$usageStats.pr'],
          },
        },
      },
      { $sort: { totalUsage: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          usageStats: 1,
          totalUsage: 1,
          'dailyUsage.count': 1,
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      summary: {
        totalUsers,
        activeUsersToday,
        totalGenerations: totalBranch + totalTests + totalPR,
        totalSharedLinks,
      },
      byTool: {
        branch: totalBranch,
        tests: totalTests,
        pr: totalPR,
      },
      recentUsers,
      topUsers,
    },
  });
});

/**
 * GET /api/admin/users
 * List all users with usage stats
 */
const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-password')
      .lean(),
    User.countDocuments(),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/**
 * PUT /api/admin/users/:id/role
 * Change a user's role
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be "user" or "admin".' });
  }

  // Prevent de-admining yourself
  if (id === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
  }

  const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  res.json({ success: true, user });
});

/**
 * PUT /api/admin/users/:id/toggle
 * Activate or deactivate a user
 */
const toggleUserActive = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: 'Cannot deactivate yourself.' });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: `User ${user.isActive ? 'activated' : 'deactivated'}.`,
    isActive: user.isActive,
  });
});

module.exports = { getPlatformStats, listUsers, updateUserRole, toggleUserActive };
