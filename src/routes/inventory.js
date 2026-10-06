const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, requireFields, withTx, nn, dateRange } = require('../utils/helpers');
const { changeBatch, signedDelta, ADJ_TYPES, round2, expiryDate, stockStatusSql } = require('../services/stock');

router.use(authenticate);

const BATCH_STATUS = `CASE WHEN b.qty <= 0 THEN 'Consumed'
  WHEN b.expiry IS NOT NULL AND b.expiry < CURRENT_DATE THEN 'Expired'
  WHEN b.expiry IS NOT NULL AND b.expiry <= CURRENT_DATE + 90 THEN 'Near Expiry'
  ELSE 'Active' END`;

const BATCH_SELECT = `
  SELECT b.*, m.name AS medicine_name, m.code AS medicine_code, m.generic, u.name AS uom,
         br.name AS branch_name, s.name AS supplier_name, g.doc_no AS grn_no,
         (b.expiry - CURRENT_DATE) AS days_left, ${BATCH_STATUS} AS status,
         ROUND(b.qty * b.unit_cost, 2) AS stock_value
  FROM batches b
  JOIN medicines m ON m.id = b.medicine_id
  LEFT JOIN lookups u ON u.id = m.uom_id
  LEFT JOIN branches br ON br.id = b.branch_id
  LEFT JOIN parties s ON s.id = b.supplier_id
  LEFT JOIN transactions g ON g.id = b.grn_txn_id`;

async function newAdjustment(client, { branch_id, user_id, adj_type, reason, lines }) {
  const doc = (await client.query(`SELECT fn_next_doc_no('adjustment') AS n`)).rows[0].n;
  const txn = (await client.query(
    `INSERT INTO transactions (doc_no, txn_type, branch_id, user_id, status, meta)
     VALUES ($1,'adjustment',$2,$3,'Completed',$4) RETURNING id`,
    [doc, branch_id || null, user_id, JSON.stringify({ adj_type, reason })])).rows[0].id;
  for (const l of lines) {
    await changeBatch(client, l.batch_id, l.delta, 'This adjustment');
    const b = (await client.query('SELECT medicine_id, unit_cost, batch_no FROM batches WHERE id = $1', [l.batch_id])).rows[0];
    await client.query(
      `INSERT INTO transaction_items (txn_id, medicine_id, batch_id, qty, unit_price, amount, description, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [txn, b.medicine_id, l.batch_id, l.delta, b.unit_cost, round2(l.delta * b.unit_cost), reason || adj_type,
       JSON.stringify({ batch_no: b.batch_no })]);
  }
  return { id: txn, doc_no: doc };
}

router.get('/stock', authorize('inv-stock', 'view'), asyncHandler(async (req, res) => {
  const params = [];
  let where = 'WHERE 1=1';
  if (req.query.branch_id) { params.push(req.query.branch_id); where += ` AND a.branch_id = $${params.length}`; }
  const { rows } = await db.query(`
    WITH a AS (
      SELECT b.medicine_id, b.branch_id,
        COALESCE(SUM(b.qty) FILTER (WHERE b.expiry IS NULL OR b.expiry >= CURRENT_DATE), 0) AS on_hand,
        COALESCE(SUM(b.qty) FILTER (WHERE b.expiry < CURRENT_DATE), 0) AS expired_qty,
        COALESCE(SUM(b.qty * b.unit_cost) FILTER (WHERE b.expiry IS NULL OR b.expiry >= CURRENT_DATE), 0) AS stock_value,
        COUNT(*) FILTER (WHERE b.qty > 0) AS batch_count
      FROM batches b GROUP BY b.medicine_id, b.branch_id)
    SELECT m.id AS medicine_id, m.code, m.name, m.generic, u.name AS uom, c.name AS category,
           a.branch_id, br.name AS branch_name,
           COALESCE(a.on_hand,0) AS on_hand, COALESCE(a.expired_qty,0) AS expired_qty,
           ROUND(COALESCE(a.stock_value,0), 2) AS stock_value, COALESCE(a.batch_count,0)::int AS batch_count,
           ${stockStatusSql('COALESCE(a.on_hand,0)')} AS status
    FROM medicines m
    LEFT JOIN a ON a.medicine_id = m.id
    LEFT JOIN branches br ON br.id = a.branch_id
    LEFT JOIN lookups u ON u.id = m.uom_id
    LEFT JOIN lookups c ON c.id = m.category_id
    ${where}
    ORDER BY m.name, br.name NULLS FIRST`, params);
  ok(res, rows);
}));

router.get('/stock/:medicineId', authorize('inv-stock', 'view'), asyncHandler(async (req, res) => {
  const params = [req.params.medicineId];
  let w = 'WHERE b.medicine_id = $1 AND b.qty > 0';
  if (req.query.branch_id) { params.push(req.query.branch_id); w += ` AND b.branch_id = $2`; }
  ok(res, (await db.query(`${BATCH_SELECT} ${w} ORDER BY b.expiry NULLS LAST, b.id`, params)).rows);
}));

router.delete('/stock/:medicineId', authorize('inv-stock', 'delete'), asyncHandler(async (req, res) => {
  const out = await withTx(async (client) => {
    const params = [req.params.medicineId];
    let w = 'medicine_id = $1 AND qty > 0';
    if (req.query.branch_id) { params.push(req.query.branch_id); w += ' AND branch_id = $2'; }
    const batches = (await client.query(`SELECT id, qty FROM batches WHERE ${w}`, params)).rows;
    if (!batches.length) throw httpError(400, 'There is no stock to clear for this item');
    return newAdjustment(client, {
      branch_id: nn(req.query.branch_id), user_id: req.user.id, adj_type: 'Stock Cleared',
      reason: 'Stock cleared from Inventory → Stock', lines: batches.map((b) => ({ batch_id: b.id, delta: -Number(b.qty) })),
    });
  });
  ok(res, out, `Stock cleared (${out.doc_no})`);
}));

router.get('/batches', authorize('inv-batches', 'view'), asyncHandler(async (req, res) => {
  const params = [];
  let w = 'WHERE 1=1' + dateRange(params, 'b.received_date', req.query);
  if (req.query.medicine_id) { params.push(req.query.medicine_id); w += ` AND b.medicine_id = $${params.length}`; }
  if (req.query.branch_id) { params.push(req.query.branch_id); w += ` AND b.branch_id = $${params.length}`; }
  ok(res, (await db.query(`${BATCH_SELECT} ${w} ORDER BY b.received_date DESC, b.id DESC`, params)).rows);
}));

const MOVE_SIGN = { grn: 1, sale: -1, sale_return: 1, purchase_return: -1, adjustment: 1 };
const MOVE_LABEL = { grn: 'Goods Received', sale: 'Sale', sale_return: 'Sale Return', purchase_return: 'Purchase Return', adjustment: 'Adjustment' };

async function batchDetail(id) {
  const b = (await db.query(`${BATCH_SELECT} WHERE b.id = $1`, [id])).rows[0];
  if (!b) throw httpError(404, 'Batch not found');
  const moves = (await db.query(
    `SELECT t.id AS txn_id, t.doc_no, t.txn_type, t.txn_date, ti.qty, p.name AS party_name, t.meta
     FROM transaction_items ti JOIN transactions t ON t.id = ti.txn_id LEFT JOIN parties p ON p.id = t.party_id
     WHERE ti.batch_id = $1 AND t.txn_type IN ('grn','sale','sale_return','purchase_return','adjustment')
     ORDER BY t.txn_date, t.id`, [id])).rows;
  b.movements = moves.map((m) => {
    const qty = Number(m.qty) * (MOVE_SIGN[m.txn_type] || 1);
    return {
      ref: m.doc_no, date: m.txn_date, type: qty >= 0 ? 'in' : 'out', qty: Math.abs(qty),
      note: `${MOVE_LABEL[m.txn_type] || m.txn_type}${m.party_name ? ' — ' + m.party_name : ''}${m.meta && m.meta.adj_type ? ' — ' + m.meta.adj_type : ''}`,
    };
  });
  return b;
}
router.get('/batches/:id', authorize('inv-batches', 'view'), asyncHandler(async (req, res) => ok(res, await batchDetail(req.params.id))));

const editBatch = asyncHandler(async (req, res) => {
  const b = req.body;
  await withTx(async (client) => {
    const cur = (await client.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Batch not found');
    if (b.batch_no !== undefined && !String(b.batch_no).trim()) throw httpError(400, 'Batch number is required');
    await client.query(
      `UPDATE batches SET batch_no = COALESCE($2, batch_no), expiry = COALESCE($3::date, expiry),
              unit_cost = COALESCE($4, unit_cost) WHERE id = $1`,
      [req.params.id, nn(b.batch_no) && String(b.batch_no).trim(), expiryDate(b.expiry), nn(b.unit_cost)]);
    if (nn(b.qty) !== null && Number(b.qty) !== Number(cur.qty)) {
      if (Number(b.qty) < 0) throw httpError(400, 'Quantity cannot be negative');
      await newAdjustment(client, {
        branch_id: cur.branch_id, user_id: req.user.id, adj_type: 'Count Correction',
        reason: 'Quantity edited on batch', lines: [{ batch_id: cur.id, delta: Number(b.qty) - Number(cur.qty) }],
      });
    }
  });
  ok(res, await batchDetail(req.params.id), 'Batch updated');
});

const deleteBatch = asyncHandler(async (req, res) => {
  await withTx(async (client) => {
    const cur = (await client.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Batch not found');
    await client.query(
      `UPDATE transaction_items SET meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('batch_no', $2::text, 'expiry', $3::text)
       WHERE batch_id = $1`, [cur.id, cur.batch_no, cur.expiry || null]);
    await client.query('DELETE FROM batches WHERE id = $1', [cur.id]);
  });
  ok(res, { id: Number(req.params.id) }, 'Batch deleted');
});

router.put('/batches/:id', authorize('inv-batches', 'edit'), editBatch);
router.delete('/batches/:id', authorize('inv-batches', 'delete'), deleteBatch);

router.get('/expiry', authorize('inv-expiry', 'view'), asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days || '180', 10) || 180, 1), 3650);
  const params = [days];
  let w = `WHERE b.qty > 0 AND b.expiry IS NOT NULL AND b.expiry <= CURRENT_DATE + $1::int`;
  w += dateRange(params, 'b.expiry', req.query);
  if (req.query.branch_id) { params.push(req.query.branch_id); w += ` AND b.branch_id = $${params.length}`; }
  ok(res, (await db.query(`${BATCH_SELECT} ${w} ORDER BY b.expiry, b.id`, params)).rows);
}));
router.get('/expiry/:id', authorize('inv-expiry', 'view'), asyncHandler(async (req, res) => ok(res, await batchDetail(req.params.id))));
router.put('/expiry/:id', authorize('inv-expiry', 'edit'), editBatch);
router.delete('/expiry/:id', authorize('inv-expiry', 'delete'), deleteBatch);

const ADJ_SELECT = `
  SELECT t.id, t.doc_no, t.txn_date, t.branch_id, br.name AS branch_name,
         t.meta->>'adj_type' AS adj_type, t.meta->>'reason' AS reason,
         COALESCE(u.full_name, u.username) AS created_by,
         ti.id AS item_id, ti.medicine_id, m.name AS medicine_name, ti.batch_id,
         COALESCE(b.batch_no, ti.meta->>'batch_no') AS batch_no, ti.qty AS delta,
         (SELECT COUNT(*) FROM transaction_items x WHERE x.txn_id = t.id)::int AS line_count
  FROM transactions t
  JOIN transaction_items ti ON ti.id = (SELECT MIN(id) FROM transaction_items WHERE txn_id = t.id)
  LEFT JOIN medicines m ON m.id = ti.medicine_id
  LEFT JOIN batches b ON b.id = ti.batch_id
  LEFT JOIN branches br ON br.id = t.branch_id
  LEFT JOIN users u ON u.id = t.user_id
  WHERE t.txn_type = 'adjustment'`;

router.get('/adjustments', authorize('inv-adjustments', 'view'), asyncHandler(async (req, res) => {
  const params = [];
  let w = dateRange(params, 't.txn_date', req.query);
  if (req.query.type && req.query.type !== 'All Types') { params.push(req.query.type); w += ` AND t.meta->>'adj_type' = $${params.length}`; }
  const rows = (await db.query(`${ADJ_SELECT} ${w} ORDER BY t.id DESC`, params)).rows;
  for (const r of rows) {
    if (r.line_count > 1) {
      r.delta = (await db.query('SELECT COALESCE(SUM(qty),0) AS s FROM transaction_items WHERE txn_id = $1', [r.id])).rows[0].s;
      r.batch_no = `${r.line_count} batches`;
    }
  }
  ok(res, rows);
}));

router.get('/adjustments/:id', authorize('inv-adjustments', 'view'), asyncHandler(async (req, res) => {
  const t = (await db.query(`SELECT fn_get_transaction($1) AS t`, [req.params.id])).rows[0].t;
  if (!t || t.txn_type !== 'adjustment') throw httpError(404, 'Adjustment not found');
  ok(res, t);
}));

router.post('/adjustments', authorize('inv-adjustments', 'create'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['batch_id', 'adj_type', 'qty']);
  if (!ADJ_TYPES.includes(req.body.adj_type)) throw httpError(400, 'Invalid adjustment type');
  const out = await withTx(async (client) => {
    const b = (await client.query('SELECT branch_id FROM batches WHERE id = $1', [req.body.batch_id])).rows[0];
    if (!b) throw httpError(400, 'Batch not found');
    return newAdjustment(client, {
      branch_id: b.branch_id, user_id: req.user.id, adj_type: req.body.adj_type, reason: nn(req.body.reason),
      lines: [{ batch_id: Number(req.body.batch_id), delta: signedDelta(req.body.adj_type, req.body.qty) }],
    });
  });
  ok(res, out, `Adjustment ${out.doc_no} saved`, 201);
}));

router.put('/adjustments/:id', authorize('inv-adjustments', 'edit'), asyncHandler(async (req, res) => {
  await withTx(async (client) => {
    const t = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'adjustment' FOR UPDATE`, [req.params.id])).rows[0];
    if (!t) throw httpError(404, 'Adjustment not found');
    const items = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1', [t.id])).rows;
    if (items.length !== 1) throw httpError(400, 'Multi-batch adjustments cannot be edited. Delete it and create a new one.');
    const it = items[0];
    const type = req.body.adj_type || t.meta.adj_type;
    if (!ADJ_TYPES.includes(type)) throw httpError(400, 'Invalid adjustment type');
    const newBatch = Number(req.body.batch_id || it.batch_id);
    const newDelta = signedDelta(type, req.body.qty !== undefined ? req.body.qty : Math.abs(it.qty));
    if (it.batch_id) await changeBatch(client, it.batch_id, -Number(it.qty), 'Reversing the old adjustment');
    await changeBatch(client, newBatch, newDelta, 'This adjustment');
    const b = (await client.query('SELECT medicine_id, unit_cost, batch_no, branch_id FROM batches WHERE id = $1', [newBatch])).rows[0];
    const reason = req.body.reason !== undefined ? nn(req.body.reason) : t.meta.reason;
    await client.query(
      `UPDATE transaction_items SET medicine_id = $2, batch_id = $3, qty = $4, unit_price = $5, amount = $6, description = $7,
              meta = jsonb_build_object('batch_no', $8::text) WHERE id = $1`,
      [it.id, b.medicine_id, newBatch, newDelta, b.unit_cost, round2(newDelta * b.unit_cost), reason || type, b.batch_no]);
    await client.query(`UPDATE transactions SET meta = $2, branch_id = $3 WHERE id = $1`,
      [t.id, JSON.stringify({ adj_type: type, reason }), b.branch_id]);
  });
  ok(res, (await db.query(`${ADJ_SELECT} AND t.id = $1`, [req.params.id])).rows[0], 'Adjustment updated');
}));

router.delete('/adjustments/:id', authorize('inv-adjustments', 'delete'), asyncHandler(async (req, res) => {
  await withTx(async (client) => {
    const t = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'adjustment' FOR UPDATE`, [req.params.id])).rows[0];
    if (!t) throw httpError(404, 'Adjustment not found');
    const items = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1', [t.id])).rows;
    for (const it of items) if (it.batch_id) await changeBatch(client, it.batch_id, -Number(it.qty), 'Reversing this adjustment');
    await client.query('DELETE FROM transactions WHERE id = $1', [t.id]);
  });
  ok(res, { id: Number(req.params.id) }, 'Adjustment deleted and stock restored');
}));

module.exports = router;
module.exports.newAdjustment = newAdjustment;
