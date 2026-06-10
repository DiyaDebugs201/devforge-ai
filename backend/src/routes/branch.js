const express = require('express');
const { body } = require('express-validator');
const { generateBranch } = require('../controllers/branchController');
const { authenticate, checkDailyLimit, incrementUsage } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/generate',
  authenticate,
  checkDailyLimit,
  aiRateLimiter,
  incrementUsage('branch'),
  [
    body('taskDescription')
      .trim()
      .isLength({ min: 3, max: 500 })
      .withMessage('Task description must be 3–500 characters'),
    body('ticketId')
      .optional()
      .trim()
      .matches(/^[A-Z0-9]+-\d+$|^$/)
      .withMessage('Ticket ID must match format like PROJ-123'),
  ],
  generateBranch
);

module.exports = router;
