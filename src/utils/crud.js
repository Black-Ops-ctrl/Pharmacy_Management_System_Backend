const router = require('express').Router;
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, requireFields, nn } = require('./helpers');

module.exports = function makeCrud(opts) {
  const r = router();
  const { table, pageKey, fields, required = [], label } = opts;
  r.use(authenticate);
  if (opts.extend) opts.extend(r);

  const getOne = async (id) => {
    const sql = opts.getSql || `SELECT * FROM ${table} WHERE id = $1`;
    return (await db.query(sql, [id])).rows[0];
  };

  r.get('/', authorize(pageKey, 'view'), asyncHandler(async (req, res) => {
    const params = [];
    const sql = opts.listSql ? opts.listSql(params, req.query) : `SELECT * FROM ${table} ORDER BY ${opts.orderBy || 'id DESC'}`;
    ok(res, (await db.query(sql, params)).rows);
  }));

  r.get('/:id', authorize(pageKey, 'view'), asyncHandler(async (req, res) => {
    const row = await getOne(req.params.id);
    if (!row) throw httpError(404, `${label} not found`);
    ok(res, row);
  }));

  r.post('/', authorize(pageKey, 'create'), asyncHandler(async (req, res) => {
    requireFields(req.body, required);
    const body = { ...(opts.transform ? opts.transform(req.body) : req.body) };
    if (opts.validate) await opts.validate(body, null);
    if (opts.userField) body[opts.userField] = req.user.id;
    const cols = [...fields, ...(opts.userField ? [opts.userField] : [])].filter((f) => body[f] !== undefined);
    const params = cols.map((f) => nn(body[f]));
    const ph = cols.map((c, i) => `$${i + 1}`);
    if (opts.codePrefix) {
      const prefix = typeof opts.codePrefix === 'function' ? opts.codePrefix() : opts.codePrefix;
      cols.push(opts.codeCol || 'code');
      ph.push(`fn_next_code('${table}','${opts.codeCol || 'code'}','${prefix}',${opts.codeWidth || 4})`);
    }
    const client = await db.connect();
    let id;
    try {
      await client.query('BEGIN');
      id = (await client.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${ph.join(',')}) RETURNING id`, params)).rows[0].id;
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    ok(res, await getOne(id), `${label} created`, 201);
  }));

  r.put('/:id', authorize(pageKey, 'edit'), asyncHandler(async (req, res) => {
    const body = opts.transform ? opts.transform(req.body) : req.body;
    if (opts.validate) await opts.validate(body, req.params.id);
    if (opts.beforeUpdate) await opts.beforeUpdate(req.params.id, body);
    const cols = fields.filter((f) => body[f] !== undefined);
    required.forEach((f) => { if (body[f] !== undefined && nn(body[f]) === null) throw httpError(400, `${f} is required`); });
    if (cols.length) {
      const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
      const { rowCount } = await db.query(`UPDATE ${table} SET ${set} WHERE id = $1${opts.scope ? ' AND ' + opts.scope : ''}`, [req.params.id, ...cols.map((f) => nn(body[f]))]);
      if (!rowCount) throw httpError(404, `${label} not found`);
    }
    const row = await getOne(req.params.id);
    if (!row) throw httpError(404, `${label} not found`);
    ok(res, row, `${label} updated`);
  }));

  r.delete('/:id', authorize(pageKey, 'delete'), asyncHandler(async (req, res) => {
    if (opts.beforeDelete) await opts.beforeDelete(req.params.id);
    const { rows } = await db.query(`DELETE FROM ${table} WHERE id = $1${opts.scope ? ' AND ' + opts.scope : ''} RETURNING id`, [req.params.id]);
    if (!rows[0]) throw httpError(404, `${label} not found`);
    ok(res, rows[0], `${label} deleted`);
  }));

  return r;
};
