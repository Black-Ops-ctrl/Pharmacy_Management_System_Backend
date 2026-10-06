const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, requireFields, withTx, nn, dateRange } = require('../utils/helpers');
const { changeBatch, round2, expiryDate } = require('../services/stock');

const getTxn = async (id, type) => {
  const t = (await db.query('SELECT fn_get_transaction($1) AS t', [id])).rows[0].t;
  return t && (!type || t.txn_type === type) ? t : null;
};

const LIST = (type, extra = '') => `
  SELECT t.id, t.doc_no, t.txn_date, t.status, t.subtotal, t.total, t.notes, t.meta,
         t.party_id, p.name AS supplier_name, t.branch_id, br.name AS branch_name, t.ref_txn_id, rt.doc_no AS ref_doc_no,
         COALESCE(u.full_name, u.username) AS created_by,
         (SELECT COUNT(*) FROM transaction_items ti WHERE ti.txn_id = t.id)::int AS item_count,
         (SELECT COALESCE(SUM(ti.qty),0) FROM transaction_items ti WHERE ti.txn_id = t.id) AS total_qty ${extra}
  FROM transactions t
  LEFT JOIN parties p ON p.id = t.party_id
  LEFT JOIN branches br ON br.id = t.branch_id
  LEFT JOIN transactions rt ON rt.id = t.ref_txn_id
  LEFT JOIN users u ON u.id = t.user_id
  WHERE t.txn_type = '${type}'`;

const listHandler = (type, extra) => asyncHandler(async (req, res) => {
  const params = [];
  let w = dateRange(params, 't.txn_date', req.query);
  if (req.query.status && req.query.status !== 'All Status') { params.push(req.query.status); w += ` AND t.status = $${params.length}`; }
  if (req.query.party_id) { params.push(req.query.party_id); w += ` AND t.party_id = $${params.length}`; }
  ok(res, (await db.query(`${LIST(type, extra)} ${w} ORDER BY t.id DESC`, params)).rows);
});

const getHandler = (type, label) => asyncHandler(async (req, res) => {
  const t = await getTxn(req.params.id, type);
  if (!t) throw httpError(404, `${label} not found`);
  ok(res, t);
});

const supplierCheck = async (client, id) => {
  const s = (await client.query(`SELECT id, name, status FROM parties WHERE id = $1 AND party_type = 'supplier'`, [id])).rows[0];
  if (!s) throw httpError(400, 'Select a valid supplier');
  return s;
};

const po = express.Router();
po.use(authenticate);
const PO_STATUSES = ['Draft', 'Sent', 'Partially Received', 'Received', 'Cancelled'];

po.get('/', authorize('purchase-orders', 'view'), listHandler('purchase_order',
  `, t.meta->>'expected_date' AS expected_date,
     (SELECT string_agg(g.doc_no, ', ') FROM transactions g WHERE g.ref_txn_id = t.id AND g.txn_type = 'grn') AS grn_nos`));
po.get('/:id', authorize('purchase-orders', 'view'), getHandler('purchase_order', 'Purchase order'));

async function savePO(client, body, userId, id) {
  requireFields(body, ['party_id']);
  await supplierCheck(client, body.party_id);
  const items = (body.items || []).filter((i) => i.medicine_id && Number(i.qty) > 0);
  if (!items.length) throw httpError(400, 'Add at least one medicine with a quantity');
  if (body.status && !PO_STATUSES.includes(body.status)) throw httpError(400, 'Invalid status');
  const meta = JSON.stringify({ expected_date: nn(body.expected_date) });
  if (id) {
    const cur = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'purchase_order' FOR UPDATE`, [id])).rows[0];
    if (!cur) throw httpError(404, 'Purchase order not found');
    await client.query('DELETE FROM transaction_items WHERE txn_id = $1', [id]);
    await client.query(`UPDATE transactions SET party_id = $2, branch_id = $3, status = COALESCE($4, status), notes = $5, meta = $6 WHERE id = $1`,
      [id, body.party_id, nn(body.branch_id), nn(body.status), nn(body.notes), meta]);
  } else {
    const doc = (await client.query(`SELECT fn_next_doc_no('purchase_order') AS n`)).rows[0].n;
    id = (await client.query(
      `INSERT INTO transactions (doc_no, txn_type, party_id, branch_id, user_id, status, notes, meta)
       VALUES ($1,'purchase_order',$2,$3,$4,COALESCE($5,'Draft'),$6,$7) RETURNING id`,
      [doc, body.party_id, nn(body.branch_id), userId, nn(body.status), nn(body.notes), meta])).rows[0].id;
  }
  let total = 0;
  for (const it of items) {
    const amt = round2(Number(it.qty) * (Number(it.unit_cost) || 0));
    total = round2(total + amt);
    await client.query(`INSERT INTO transaction_items (txn_id, medicine_id, qty, unit_price, amount) VALUES ($1,$2,$3,$4,$5)`,
      [id, it.medicine_id, Number(it.qty), Number(it.unit_cost) || 0, amt]);
  }
  await client.query('UPDATE transactions SET subtotal = $2, total = $2 WHERE id = $1', [id, total]);
  return id;
}

po.post('/', authorize('purchase-orders', 'create'), asyncHandler(async (req, res) => {
  const id = await withTx((c) => savePO(c, req.body, req.user.id));
  ok(res, await getTxn(id), 'Purchase order created', 201);
}));
po.put('/:id', authorize('purchase-orders', 'edit'), asyncHandler(async (req, res) => {
  const id = await withTx((c) => savePO(c, req.body, req.user.id, Number(req.params.id)));
  ok(res, await getTxn(id), 'Purchase order updated');
}));
po.delete('/:id', authorize('purchase-orders', 'delete'), asyncHandler(async (req, res) => {
  const t = (await db.query(`SELECT doc_no FROM transactions WHERE id = $1 AND txn_type = 'purchase_order'`, [req.params.id])).rows[0];
  if (!t) throw httpError(404, 'Purchase order not found');
  const g = (await db.query(`SELECT doc_no FROM transactions WHERE ref_txn_id = $1 AND txn_type = 'grn'`, [req.params.id])).rows;
  if (g.length) throw httpError(400, `Goods have been received against this order (${g.map((x) => x.doc_no).join(', ')}). Delete the GRN first.`);
  await db.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
  ok(res, { id: Number(req.params.id) }, `Purchase order ${t.doc_no} deleted`);
}));

async function refreshPOStatus(client, poId) {
  if (!poId) return;
  const p = (await client.query(`SELECT status FROM transactions WHERE id = $1 AND txn_type = 'purchase_order'`, [poId])).rows[0];
  if (!p || p.status === 'Cancelled') return;
  const rows = (await client.query(
    `SELECT o.medicine_id, SUM(o.qty) AS ordered,
            COALESCE((SELECT SUM(gi.qty) FROM transaction_items gi JOIN transactions g ON g.id = gi.txn_id
                      WHERE g.ref_txn_id = $1 AND g.txn_type = 'grn' AND gi.medicine_id = o.medicine_id), 0) AS received
     FROM transaction_items o WHERE o.txn_id = $1 GROUP BY o.medicine_id`, [poId])).rows;
  const anyReceived = rows.some((r) => Number(r.received) > 0);
  const allReceived = rows.length && rows.every((r) => Number(r.received) >= Number(r.ordered));
  const status = allReceived ? 'Received' : anyReceived ? 'Partially Received' : (p.status === 'Received' || p.status === 'Partially Received' ? 'Sent' : p.status);
  await client.query('UPDATE transactions SET status = $2 WHERE id = $1', [poId, status]);
}

const grn = express.Router();
grn.use(authenticate);

grn.get('/', authorize('grn', 'view'), listHandler('grn'));
grn.get('/:id', authorize('grn', 'view'), getHandler('grn', 'GRN'));

async function saveGRN(client, body, userId, id) {
  requireFields(body, ['party_id', 'branch_id']);
  await supplierCheck(client, body.party_id);
  const lines = (body.lines || []).filter((l) => l.medicine_id || l.id);
  if (!lines.length) throw httpError(400, 'Add at least one received line');
  lines.forEach((l, i) => {
    if (!nn(l.batch_no)) throw httpError(400, `Line ${i + 1}: batch number is required`);
    if (!(Number(l.qty) > 0)) throw httpError(400, `Line ${i + 1}: quantity must be more than 0`);
    if (!nn(l.expiry)) throw httpError(400, `Line ${i + 1}: expiry date is required`);
  });
  let poId = nn(body.po_id);
  if (poId) {
    const p = (await client.query(`SELECT id, party_id, status FROM transactions WHERE id = $1 AND txn_type = 'purchase_order'`, [poId])).rows[0];
    if (!p) throw httpError(400, 'Purchase order not found');
    if (p.status === 'Cancelled') throw httpError(400, 'This purchase order is cancelled');
  }
  const date = nn(body.grn_date);
  let oldPo = null;
  if (id) {
    const cur = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'grn' FOR UPDATE`, [id])).rows[0];
    if (!cur) throw httpError(404, 'GRN not found');
    oldPo = cur.ref_txn_id;
    const oldItems = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1', [id])).rows;
    const keep = new Set(lines.filter((l) => l.id).map((l) => Number(l.id)));
    for (const it of oldItems.filter((x) => !keep.has(x.id))) {
      if (it.batch_id) {
        const b = (await client.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [it.batch_id])).rows[0];
        if (b && Number(b.qty) < Number(it.qty)) throw httpError(400, `Batch ${b.batch_no} has already been partly sold/used and cannot be removed`);
        if (b) {
          await client.query('UPDATE transaction_items SET batch_id = NULL WHERE batch_id = $1 AND txn_id <> $2', [b.id, id]);
          await client.query('DELETE FROM batches WHERE id = $1', [b.id]);
        }
      }
      await client.query('DELETE FROM transaction_items WHERE id = $1', [it.id]);
    }
    await client.query(`UPDATE transactions SET party_id = $2, branch_id = $3, ref_txn_id = $4, notes = $5,
                          txn_date = COALESCE($6::timestamptz, txn_date), meta = $7 WHERE id = $1`,
      [id, body.party_id, body.branch_id, poId, nn(body.notes), date, JSON.stringify({ supplier_invoice: nn(body.supplier_invoice) })]);
  } else {
    const doc = (await client.query(`SELECT fn_next_doc_no('grn') AS n`)).rows[0].n;
    id = (await client.query(
      `INSERT INTO transactions (doc_no, txn_type, party_id, branch_id, user_id, ref_txn_id, status, notes, txn_date, meta)
       VALUES ($1,'grn',$2,$3,$4,$5,'Posted',$6,COALESCE($7::timestamptz, now()),$8) RETURNING id`,
      [doc, body.party_id, body.branch_id, userId, poId, nn(body.notes), date, JSON.stringify({ supplier_invoice: nn(body.supplier_invoice) })])).rows[0].id;
  }
  const recvDate = date || new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const l of lines) {
    const qty = Number(l.qty);
    const cost = Number(l.unit_cost) || 0;
    const amt = round2(qty * cost);
    total = round2(total + amt);
    if (l.id) {
      const it = (await client.query('SELECT * FROM transaction_items WHERE id = $1 AND txn_id = $2', [l.id, id])).rows[0];
      if (!it) throw httpError(400, 'GRN line not found');
      if (it.batch_id) {
        const b = (await client.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [it.batch_id])).rows[0];
        const delta = qty - Number(it.qty);
        if (Number(b.qty) + delta < 0) throw httpError(400, `Batch ${b.batch_no}: ${Number(it.qty) - Number(b.qty)} units are already sold/used, quantity cannot go below that`);
        await client.query(
          `UPDATE batches SET medicine_id = $2, batch_no = $3, expiry = $4, unit_cost = $5, qty = qty + $6, received_qty = $7,
                  branch_id = $8, supplier_id = $9, received_date = $10 WHERE id = $1`,
          [b.id, l.medicine_id || b.medicine_id, String(l.batch_no).trim(), expiryDate(l.expiry), cost, delta, qty, body.branch_id, body.party_id, recvDate]);
      }
      await client.query(`UPDATE transaction_items SET medicine_id = COALESCE($2, medicine_id), qty = $3, unit_price = $4, amount = $5,
                            meta = jsonb_build_object('batch_no', $6::text, 'expiry', $7::text) WHERE id = $1`,
        [it.id, nn(l.medicine_id), qty, cost, amt, String(l.batch_no).trim(), expiryDate(l.expiry)]);
    } else {
      const bId = (await client.query(
        `INSERT INTO batches (medicine_id, branch_id, supplier_id, grn_txn_id, batch_no, expiry, received_date, received_qty, qty, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9) RETURNING id`,
        [l.medicine_id, body.branch_id, body.party_id, id, String(l.batch_no).trim(), expiryDate(l.expiry), recvDate, qty, cost])).rows[0].id;
      await client.query(
        `INSERT INTO transaction_items (txn_id, medicine_id, batch_id, qty, unit_price, amount, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, l.medicine_id, bId, qty, cost, amt, JSON.stringify({ batch_no: String(l.batch_no).trim(), expiry: expiryDate(l.expiry) })]);
    }
  }
  await client.query('UPDATE transactions SET subtotal = $2, total = $2 WHERE id = $1', [id, total]);
  await refreshPOStatus(client, poId);
  if (oldPo && oldPo !== poId) await refreshPOStatus(client, oldPo);
  return id;
}

grn.post('/', authorize('grn', 'create'), asyncHandler(async (req, res) => {
  const id = await withTx((c) => saveGRN(c, req.body, req.user.id));
  ok(res, await getTxn(id), 'GRN posted — stock updated', 201);
}));
grn.put('/:id', authorize('grn', 'edit'), asyncHandler(async (req, res) => {
  const id = await withTx((c) => saveGRN(c, req.body, req.user.id, Number(req.params.id)));
  ok(res, await getTxn(id), 'GRN updated — stock adjusted');
}));
grn.delete('/:id', authorize('grn', 'delete'), asyncHandler(async (req, res) => {
  const doc = await withTx(async (client) => {
    const cur = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'grn' FOR UPDATE`, [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'GRN not found');
    const items = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1', [cur.id])).rows;
    for (const it of items) {
      if (!it.batch_id) continue;
      const b = (await client.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [it.batch_id])).rows[0];
      if (b && Number(b.qty) < Number(it.qty)) {
        throw httpError(400, `Stock from batch ${b.batch_no} has already been sold/used. This GRN cannot be deleted.`);
      }
    }
    for (const it of items) {
      if (!it.batch_id) continue;
      await client.query('UPDATE transaction_items SET batch_id = NULL WHERE batch_id = $1 AND txn_id <> $2', [it.batch_id, cur.id]);
      await client.query('DELETE FROM batches WHERE id = $1', [it.batch_id]);
    }
    await client.query('DELETE FROM transactions WHERE id = $1', [cur.id]);
    await refreshPOStatus(client, cur.ref_txn_id);
    return cur.doc_no;
  });
  ok(res, { id: Number(req.params.id) }, `GRN ${doc} deleted — stock removed`);
}));

const pr = express.Router();
pr.use(authenticate);
const PR_STATUSES = ['Pending', 'Dispatched', 'Credited', 'Rejected'];

pr.get('/', authorize('purchase-returns', 'view'), listHandler('purchase_return',
  `, t.meta->>'reason' AS reason,
     (SELECT string_agg(DISTINCT m.name, ', ') FROM transaction_items ti JOIN medicines m ON m.id = ti.medicine_id WHERE ti.txn_id = t.id) AS medicines,
     (SELECT string_agg(COALESCE(b.batch_no, ti.meta->>'batch_no'), ', ') FROM transaction_items ti LEFT JOIN batches b ON b.id = ti.batch_id WHERE ti.txn_id = t.id) AS batches`));
pr.get('/:id', authorize('purchase-returns', 'view'), getHandler('purchase_return', 'Purchase return'));

async function savePR(client, body, userId, id) {
  requireFields(body, ['party_id']);
  await supplierCheck(client, body.party_id);
  const items = (body.items || []).filter((i) => i.batch_id && Number(i.qty) > 0);
  if (!items.length) throw httpError(400, 'Select a batch and enter a quantity');
  if (body.status && !PR_STATUSES.includes(body.status)) throw httpError(400, 'Invalid status');
  const meta = JSON.stringify({ reason: nn(body.reason) });
  if (id) {
    const cur = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'purchase_return' FOR UPDATE`, [id])).rows[0];
    if (!cur) throw httpError(404, 'Purchase return not found');
    const old = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1', [id])).rows;
    for (const it of old) if (it.batch_id) await changeBatch(client, it.batch_id, Number(it.qty), 'Restoring stock');
    await client.query('DELETE FROM transaction_items WHERE txn_id = $1', [id]);
    await client.query('UPDATE transactions SET party_id = $2, status = COALESCE($3, status), notes = $4, meta = $5 WHERE id = $1',
      [id, body.party_id, nn(body.status), nn(body.note), meta]);
  } else {
    const doc = (await client.query(`SELECT fn_next_doc_no('purchase_return') AS n`)).rows[0].n;
    id = (await client.query(
      `INSERT INTO transactions (doc_no, txn_type, party_id, user_id, status, notes, meta)
       VALUES ($1,'purchase_return',$2,$3,COALESCE($4,'Pending'),$5,$6) RETURNING id`,
      [doc, body.party_id, userId, nn(body.status), nn(body.note), meta])).rows[0].id;
  }
  let total = 0;
  let branchId = null;
  for (const it of items) {
    const b = await changeBatch(client, it.batch_id, -Number(it.qty), 'This return');
    branchId = branchId || b.branch_id;
    const amt = round2(Number(it.qty) * Number(b.unit_cost));
    total = round2(total + amt);
    await client.query(
      `INSERT INTO transaction_items (txn_id, medicine_id, batch_id, qty, unit_price, amount, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, b.medicine_id, b.id, Number(it.qty), b.unit_cost, amt, JSON.stringify({ batch_no: b.batch_no })]);
  }
  await client.query('UPDATE transactions SET subtotal = $2, total = $2, branch_id = $3 WHERE id = $1', [id, total, branchId]);
  return id;
}

pr.post('/', authorize('purchase-returns', 'create'), asyncHandler(async (req, res) => {
  const id = await withTx((c) => savePR(c, req.body, req.user.id));
  ok(res, await getTxn(id), 'Purchase return saved — stock reduced', 201);
}));
pr.put('/:id', authorize('purchase-returns', 'edit'), asyncHandler(async (req, res) => {
  const id = await withTx((c) => savePR(c, req.body, req.user.id, Number(req.params.id)));
  ok(res, await getTxn(id), 'Purchase return updated');
}));
pr.delete('/:id', authorize('purchase-returns', 'delete'), asyncHandler(async (req, res) => {
  const doc = await withTx(async (client) => {
    const cur = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'purchase_return' FOR UPDATE`, [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Purchase return not found');
    const items = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1', [cur.id])).rows;
    for (const it of items) if (it.batch_id) await changeBatch(client, it.batch_id, Number(it.qty), 'Restoring stock');
    await client.query('DELETE FROM transactions WHERE id = $1', [cur.id]);
    return cur.doc_no;
  });
  ok(res, { id: Number(req.params.id) }, `Purchase return ${doc} deleted — stock restored`);
}));

module.exports = { po, grn, pr };
