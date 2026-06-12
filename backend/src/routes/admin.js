const express = require('express');
const { getPlatformStats, listUsers, updateUserRole, toggleUserActive } = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication AND admin role
router.use(authenticate, requireAdmin);

router.get('/stats', getPlatformStats);
router.get('/users', listUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/toggle', toggleUserActive);

module.exports = router;
