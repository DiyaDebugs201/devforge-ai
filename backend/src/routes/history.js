const express = require('express');
const { getHistory, deleteHistoryItem, getDashboard } = require('../controllers/historyController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Dashboard summary
router.get('/dashboard', authenticate, getDashboard);

// Tool-specific history
router.get('/:tool', authenticate, getHistory);

// Delete a history item
router.delete('/:tool/:id', authenticate, deleteHistoryItem);

module.exports = router;
