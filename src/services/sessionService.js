const crypto = require('crypto');
const db = require('../config/db');

const TTL = () => Number(process.env.SESSION_TTL_MINUTES || 30);

class SessionService {
  static async create(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const { rows } = await db.query(
      `INSERT INTO sessions (token, user_id, expires_at)
       VALUES ($1, $2, now() + ($3 || ' minutes')::interval)
       RETURNING token, expires_at`,
      [token, userId, String(TTL())]
    );
    db.query('DELETE FROM sessions WHERE expires_at <= now()').catch(() => {});
    return rows[0];
  }

  static async touch(token) {
    const { rows } = await db.query(
      `UPDATE sessions s SET last_seen = now(), expires_at = now() + ($2 || ' minutes')::interval
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE s.token = $1 AND s.expires_at > now() AND u.id = s.user_id AND u.status = 'Active'
       RETURNING s.expires_at, u.id, u.username, u.full_name, r.name AS role, r.permissions`,
      [token, String(TTL())]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: r.id, username: r.username, name: r.full_name || r.username, role: r.role || '', permissions: r.permissions || {}, expires_at: r.expires_at };
  }

  static async destroy(token) { await db.query('DELETE FROM sessions WHERE token = $1', [token]); }
  static async destroyAllForUser(userId) { await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]); }
}

module.exports = SessionService;
