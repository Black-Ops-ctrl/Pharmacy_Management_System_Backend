const router = require('express').Router();
const db = require('../config/db');
const SessionService = require('../services/sessionService');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ok, httpError, requireFields } = require('../utils/helpers');

router.post('/login', asyncHandler(async (req, res) => {
  requireFields(req.body, ['username', 'password']);
  const { rows } = await db.query(
    `SELECT u.*, r.name AS role, r.permissions FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE lower(u.username) = lower($1)`, [String(req.body.username).trim()]);
  const u = rows[0];
  if (!u || String(req.body.password) !== u.password) throw httpError(401, 'Invalid username or password');
  if (u.status !== 'Active') throw httpError(403, 'This account is inactive. Contact your administrator.');
  const session = await SessionService.create(u.id);
  ok(res, {
    token: session.token,
    expires_at: session.expires_at,
    user: { id: u.id, username: u.username, name: u.full_name || u.username, role: u.role || '', permissions: u.permissions || {} },
  }, 'Login successful');
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => ok(res, req.user)));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await SessionService.destroy(req.sessionToken);
  ok(res, null, 'Logged out');
}));

router.put('/password', authenticate, asyncHandler(async (req, res) => {
  requireFields(req.body, ['current_password', 'new_password']);
  const { rows } = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  if (String(req.body.current_password) !== rows[0].password) throw httpError(400, 'Current password is incorrect');
  await db.query('UPDATE users SET password = $2 WHERE id = $1', [req.user.id, String(req.body.new_password)]);
  ok(res, null, 'Password changed');
}));

module.exports = router;
