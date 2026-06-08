require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectDB } = require('./config/database');
const { globalRateLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const branchRoutes = require('./routes/branch');
const testsRoutes = require('./routes/tests');
const prRoutes = require('./routes/pr');
const historyRoutes = require('./routes/history');
const shareRoutes = require('./routes/share');
const adminRoutes = require('./routes/admin');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Global rate limiter (protects all routes)
app.use(globalRateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/branch', branchRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/pr', prRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 DevKit API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
