const db = require('../config/db');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data, message, status = 200) =>
  res.status(status).json({ success: true, ...(message ? { message } : {}), data });

const httpError = (status, message) => { const e = new Error(message); e.status = status; return e; };

const requireFields = (body, fields) => {
  const miss = fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
  if (miss.length) throw httpError(400, `Missing required field(s): ${miss.join(', ')}`);
};

const withTx = async (fn) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
};

const nn = (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

const dateRange = (params, col, { from, to } = {}) => {
  let sql = '';
  if (from) { params.push(from); sql += ` AND ${col}::date >= $${params.length}`; }
  if (to)   { params.push(to);   sql += ` AND ${col}::date <= $${params.length}`; }
  return sql;
};

module.exports = { asyncHandler, ok, httpError, requireFields, withTx, nn, num, dateRange };
