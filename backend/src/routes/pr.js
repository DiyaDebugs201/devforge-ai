const express = require('express');
const { body } = require('express-validator');
const { generatePR } = require('../controllers/prController');
const { authenticate, checkDailyLimit, incrementUsage } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/generate',
  authenticate,
  checkDailyLimit,
  aiRateLimiter,
  incrementUsage('pr'),
  [
    body('rawDiff')
      .optional()
      .isString()
      .isLength({ max: 50000 })
      .withMessage('Diff must be a string under 50,000 characters'),
    body('prUrl')
      .optional()
      .isURL()
      .withMessage('Must be a valid URL'),
    body('mode')
      .optional()
      .isIn(['concise', 'detailed'])
      .withMessage('Mode must be "concise" or "detailed"'),
    body().custom((_, { req }) => {
      if (!req.body.rawDiff && !req.body.prUrl) {
        throw new Error('Provide either rawDiff or prUrl');
      }
      return true;
    }),
  ],
  generatePR
);

module.exports = router;
