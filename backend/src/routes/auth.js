const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, updateBranchConfig } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', authRateLimiter, registerValidation, register);
router.post('/login', authRateLimiter, loginValidation, login);
router.get('/me', authenticate, getMe);
router.put('/branch-config', authenticate, updateBranchConfig);

module.exports = router;
