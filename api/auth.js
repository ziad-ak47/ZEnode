const jwt = require('jsonwebtoken');
require('dotenv').config();

const ACCESS_SECRET  = process.env.JWT_SECRET         || 'zenode-access-dev';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'zenode-refresh-dev';

const signAccess  = (p) => jwt.sign(p, ACCESS_SECRET,  { expiresIn: '15m' });
const signRefresh = (p) => jwt.sign(p, REFRESH_SECRET, { expiresIn: '30d' });
const verifyAccess  = (t) => jwt.verify(t, ACCESS_SECRET);
const verifyRefresh = (t) => jwt.verify(t, REFRESH_SECRET);

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.user = verifyAccess(h.slice(7));
    next();
  } catch (e) {
    const expired = e.name === 'TokenExpiredError';
    res.status(401).json({ error: expired ? 'Token expired' : 'Invalid token', code: expired ? 'TOKEN_EXPIRED' : 'INVALID' });
  }
}

function verifyWsToken(token) {
  try { return verifyAccess(token); } catch { return null; }
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, requireAuth, verifyWsToken };
