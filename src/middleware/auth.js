const SessionService = require('../services/sessionService');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-session-token'];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    const user = await SessionService.touch(token);
    if (!user) return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });

    req.user = user;
    req.sessionToken = token;
    res.set('X-Session-Expires', user.expires_at);
    next();
  } catch (e) {
    next(e);
  }
};

const authorize = (pageKey, action = 'view') => (req, res, next) => {
  const u = req.user;
  if (!u) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (u.role === 'Super Admin') return next();
  const p = u.permissions && u.permissions[pageKey];
  if (p && p[action]) return next();
  return res.status(403).json({ success: false, error: 'You do not have permission to perform this action' });
};

const authorizeAny = (pageKeys, action = 'view') => (req, res, next) => {
  const u = req.user;
  if (u.role === 'Super Admin') return next();
  if (pageKeys.some((k) => u.permissions && u.permissions[k] && u.permissions[k][action])) return next();
  return res.status(403).json({ success: false, error: 'You do not have permission to perform this action' });
};

module.exports = { authenticate, authorize, authorizeAny };
