const router = require('express').Router();
const db = require('../config/db');
const SessionService = require('../services/sessionService');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, requireFields, nn } = require('../utils/helpers');
const { PAGES } = require('../config/permissions');

router.use(authenticate);

const cleanPerms = (p = {}) => {
  const out = {};
  Object.entries(PAGES).forEach(([key, actions]) => {
    const src = p[key] || {};
    const row = { view: !!src.view, create: false, edit: false, delete: false, print: false };
    actions.forEach((a) => { row[a] = !!src[a]; });
    if (!row.view) actions.forEach((a) => { row[a] = false; });
    out[key] = row;
  });
  return out;
};

router.get('/roles', authorize('admin', 'view'), asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id)::int AS user_count
     FROM roles r ORDER BY r.id`);
  ok(res, rows);
}));

router.post('/roles', authorize('admin', 'create'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name']);
  const { rows } = await db.query('INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING *',
    [req.body.name.trim(), JSON.stringify(cleanPerms(req.body.permissions))]);
  ok(res, rows[0], 'Role created', 201);
}));

router.put('/roles/:id', authorize('admin', 'edit'), asyncHandler(async (req, res) => {
  const cur = (await db.query('SELECT * FROM roles WHERE id = $1', [req.params.id])).rows[0];
  if (!cur) throw httpError(404, 'Role not found');
  if (cur.name === 'Super Admin' && req.body.name && req.body.name !== 'Super Admin') throw httpError(400, 'Super Admin role cannot be renamed');
  const { rows } = await db.query(
    'UPDATE roles SET name = COALESCE($2, name), permissions = COALESCE($3, permissions) WHERE id = $1 RETURNING *',
    [req.params.id, nn(req.body.name) && req.body.name.trim(), req.body.permissions ? JSON.stringify(cleanPerms(req.body.permissions)) : null]);
  ok(res, rows[0], 'Role updated');
}));

router.delete('/roles/:id', authorize('admin', 'delete'), asyncHandler(async (req, res) => {
  const cur = (await db.query('SELECT * FROM roles WHERE id = $1', [req.params.id])).rows[0];
  if (!cur) throw httpError(404, 'Role not found');
  if (cur.name === 'Super Admin') throw httpError(400, 'Super Admin role cannot be deleted');
  const used = (await db.query('SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1', [req.params.id])).rows[0].n;
  if (used) throw httpError(400, `${used} user(s) have this role. Change their role first.`);
  await db.query('DELETE FROM roles WHERE id = $1', [req.params.id]);
  ok(res, { id: Number(req.params.id) }, 'Role deleted');
}));

const USER_COLS = `u.id, u.username, u.full_name, u.status, u.role_id, r.name AS role, u.created_at`;

router.get('/users', authorize('admin', 'view'), asyncHandler(async (req, res) => {
  const { rows } = await db.query(`SELECT ${USER_COLS} FROM users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.id`);
  ok(res, rows);
}));

router.post('/users', authorize('admin', 'create'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['username', 'password', 'full_name', 'role_id']);
  const { rows } = await db.query(
    `INSERT INTO users (username, password, full_name, role_id, status)
     VALUES (lower($1), $2, $3, $4, COALESCE($5,'Active')) RETURNING id`,
    [req.body.username.trim(), String(req.body.password), req.body.full_name.trim(), req.body.role_id, nn(req.body.status)]);
  const u = (await db.query(`SELECT ${USER_COLS} FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [rows[0].id])).rows[0];
  ok(res, u, 'User created', 201);
}));

router.put('/users/:id', authorize('admin', 'edit'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  if (id === req.user.id && b.status && b.status !== 'Active') throw httpError(400, 'You cannot deactivate your own account');
  const pw = nn(b.password) ? String(b.password) : null;
  const { rowCount } = await db.query(
    `UPDATE users SET username = COALESCE(lower($2), username), full_name = COALESCE($3, full_name),
            role_id = COALESCE($4, role_id), status = COALESCE($5, status), password = COALESCE($6, password)
     WHERE id = $1`,
    [id, nn(b.username) && b.username.trim(), nn(b.full_name), nn(b.role_id), nn(b.status), pw]);
  if (!rowCount) throw httpError(404, 'User not found');
  if (pw || (b.status && b.status !== 'Active')) {
    if (id !== req.user.id) await SessionService.destroyAllForUser(id);
  }
  const u = (await db.query(`SELECT ${USER_COLS} FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [id])).rows[0];
  ok(res, u, 'User updated');
}));

router.delete('/users/:id', authorize('admin', 'delete'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw httpError(400, 'You cannot delete your own account');
  const { rows } = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (!rows[0]) throw httpError(404, 'User not found');
  ok(res, rows[0], 'User deleted');
}));

module.exports = router;
