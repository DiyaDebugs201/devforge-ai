const express = require('express');
const { body } = require('express-validator');
const { generateTestSuite } = require('../controllers/testsController');
const { authenticate, checkDailyLimit, incrementUsage } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/generate',
  authenticate,
  checkDailyLimit,
  aiRateLimiter,
  incrementUsage('tests'),
  [
    body('functionCode')
      .trim()
      .isLength({ min: 10, max: 10000 })
      .withMessage('Function code must be 10–10,000 characters'),
    body('language')
      .optional()
      .isIn(['javascript', 'typescript'])
      .withMessage('Language must be "javascript" or "typescript"'),
  ],
  generateTestSuite
);

module.exports = router;
