const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Generate JWT token
 */
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password } = req.body;

  // Check if email already exists
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered.' });
  }

  // Check if first user — make them admin
  const userCount = await User.countDocuments();
  const role = userCount === 0 || email.toLowerCase() === process.env.ADMIN_EMAIL ? 'admin' : 'user';

  const user = await User.create({ name, email, password, role });
  const token = signToken(user._id);

  res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      usageStats: user.usageStats,
      dailyUsage: user.dailyUsage,
    },
  });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  // Explicitly select password (it's excluded by default)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  // Update last login
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Login successful.',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      usageStats: user.usageStats,
      dailyUsage: user.dailyUsage,
      branchConfig: user.branchConfig,
    },
  });
});

/**
 * GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      usageStats: user.usageStats,
      dailyUsage: user.dailyUsage,
      branchConfig: user.branchConfig,
      createdAt: user.createdAt,
    },
  });
});

/**
 * PUT /api/auth/branch-config
 * Save user's custom branch naming configuration
 */
const updateBranchConfig = asyncHandler(async (req, res) => {
  const { prefixes, ticketPrefix, separator, maxLength } = req.body;

  const update = {};
  if (prefixes && Array.isArray(prefixes)) update['branchConfig.prefixes'] = prefixes;
  if (ticketPrefix !== undefined) update['branchConfig.ticketPrefix'] = ticketPrefix;
  if (separator) update['branchConfig.separator'] = separator;
  if (maxLength) update['branchConfig.maxLength'] = Math.min(Math.max(30, maxLength), 100);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: update },
    { new: true, runValidators: true }
  );

  res.json({ success: true, branchConfig: user.branchConfig });
});

module.exports = { register, login, getMe, updateBranchConfig };
