const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verifies JWT token and attaches user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Requires admin role — must be used AFTER authenticate middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Admin access required.',
    });
  }
  next();
};

/**
 * Check and enforce daily AI usage limit
 */
const checkDailyLimit = async (req, res, next) => {
  try {
    const user = req.user;
    const LIMIT = parseInt(process.env.DAILY_AI_REQUEST_LIMIT || '20', 10);
    const today = new Date().toISOString().split('T')[0];

    // Reset if a new day
    if (user.dailyUsage.date !== today) {
      await User.findByIdAndUpdate(user._id, {
        'dailyUsage.count': 0,
        'dailyUsage.date': today,
      });
      user.dailyUsage.count = 0;
      user.dailyUsage.date = today;
    }

    if (user.dailyUsage.count >= LIMIT) {
      return res.status(429).json({
        success: false,
        message: `Daily AI request limit reached (${LIMIT}/day). Resets at midnight UTC.`,
        limit: LIMIT,
        used: user.dailyUsage.count,
        resetsAt: `${today}T24:00:00.000Z`,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Increment daily usage counter + tool-specific counter after successful AI generation
 */
const incrementUsage = (tool) => async (req, res, next) => {
  // We do this after response — use res.on('finish')
  res.on('finish', async () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        await User.findByIdAndUpdate(req.user._id, {
          $inc: {
            'dailyUsage.count': 1,
            [`usageStats.${tool}`]: 1,
          },
        });
      } catch (err) {
        console.error('Failed to increment usage:', err.message);
      }
    }
  });
  next();
};

module.exports = { authenticate, requireAdmin, checkDailyLimit, incrementUsage };
