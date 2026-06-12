const express = require('express');
const { createShareLink, getSharedItem, revokeShareLink } = require('../controllers/shareController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Public route — no auth required
router.get('/:shareId', getSharedItem);

// Authenticated routes
router.post('/:tool/:id', authenticate, createShareLink);
router.delete('/:tool/:id', authenticate, revokeShareLink);

module.exports = router;
