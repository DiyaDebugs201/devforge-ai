const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter — applied to all routes
 * Protects against brute force and DDoS
 */
const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
  skip: (req) => req.path === '/health', // Skip health checks
});

/**
 * Strict auth rate limiter — for login/register
 * Prevents brute force attacks on credentials
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: true,
});

/**
 * AI endpoint rate limiter — per-IP protection
 * Secondary protection alongside per-user daily limit
 */
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 AI requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests. Please wait a moment before trying again.',
  },
});

module.exports = { globalRateLimiter, authRateLimiter, aiRateLimiter };
