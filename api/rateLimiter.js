const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Too many attempts. Wait 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 200,
  message: { error: 'Too many requests.' },
  standardHeaders: true, legacyHeaders: false,
});

const messageLimiter = rateLimit({
  windowMs: 10 * 1000, max: 20,
  // Users are always authenticated; key on user ID so IP is never used
  keyGenerator: (req) => String(req.user?.id || 'anon'),
  skip: (req) => false,
  validate: { xForwardedForHeader: false },
  message: { error: 'Sending too fast. Slow down.' },
  standardHeaders: true, legacyHeaders: false,
});

// Per-WebSocket in-memory rate limiter
class WsRateLimiter {
  constructor(max = 25, windowMs = 10000) {
    this.max = max; this.window = windowMs; this.counts = new Map();
  }
  check(id) {
    const now = Date.now();
    let e = this.counts.get(id);
    if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + this.window }; this.counts.set(id, e); }
    return ++e.count <= this.max;
  }
  clear(id) { this.counts.delete(id); }
}

module.exports = { authLimiter, apiLimiter, messageLimiter, WsRateLimiter };
