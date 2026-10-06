const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, requireFields, withTx, nn, dateRange } = require('../utils/helpers');
const { allocateFEFO, changeBatch, round2 } = require('../services/stock');

const getTxn = async (id, type) => {
  const t = (await db.query('SELECT fn_get_transaction($1) AS t', [id])).rows[0].t;
  if (!t || (type && t.txn_type !== type)) return null;
  return t;
};

const invoiceLines = (items) => {
  const map = new Map();
  items.forEach((it) => {
    const m = it.meta || {};
    const key = `${it.medicine_id}|${m.sale_type || 'single'}`;
    const factor = Number(m.factor) || 1;
    if (!map.has(key)) {
      map.set(key, { medicine_id: it.medicine_id, medicine: it.medicine, sale_type: m.sale_type || 'single',
        unit: m.unit_label || 'Unit', factor, price: Number(m.sale_unit_price) || 0, units: 0, qty: 0, amount: 0, batches: [] });
    }
    const l = map.get(key);
    l.units += Number(it.qty);
    l.amount = round2(l.amount + Number(it.amount));
    l.batches.push({ batch_id: it.batch_id, batch_no: it.batch_no, expiry: it.expiry, units: Number(it.qty) });
  });
  return [...map.values()].map((l) => ({ ...l, qty: round2(l.units / l.factor), batch: l.batches.map((b) => b.batch_no).filter(Boolean).join(', ') }));
};

const withLines = (t) => (t ? { ...t, lines: invoiceLines(t.items) } : t);

const sales = express.Router();
sales.use(authenticate);

const SALE_LIST = `
  SELECT t.id, t.doc_no, t.txn_date, t.status, t.payment_method, t.subtotal, t.discount, t.tax, t.total,
         t.party_id, COALESCE(p.name, t.meta->>'customer_name', 'Walk-in Customer') AS customer_name,
         t.meta->>'customer_type' AS customer_type, t.branch_id, br.name AS branch_name,
         COALESCE(u.full_name, u.username) AS cashier,
         (SELECT COUNT(DISTINCT (ti.medicine_id::text || COALESCE(ti.meta->>'sale_type',''))) FROM transaction_items ti WHERE ti.txn_id = t.id)::int AS item_count,
         (SELECT COUNT(*) FROM transactions r WHERE r.ref_txn_id = t.id AND r.txn_type = 'sale_return')::int AS return_count
  FROM transactions t
  LEFT JOIN parties p ON p.id = t.party_id
  LEFT JOIN branches br ON br.id = t.branch_id
  LEFT JOIN users u ON u.id = t.user_id
  WHERE t.txn_type = 'sale'`;

sales.get('/', authorize('sale-invoices', 'view'), asyncHandler(async (req, res) => {
  const params = [];
  let w = dateRange(params, 't.txn_date', req.query);
  if (req.query.branch_id) { params.push(req.query.branch_id); w += ` AND t.branch_id = $${params.length}`; }
  if (req.query.payment) { params.push(req.query.payment); w += ` AND t.payment_method = $${params.length}`; }
  ok(res, (await db.query(`${SALE_LIST} ${w} ORDER BY t.id DESC`, params)).rows);
}));

sales.get('/:id', authorize('sale-invoices', 'view'), asyncHandler(async (req, res) => {
  const t = await getTxn(req.params.id, 'sale');
  if (!t) throw httpError(404, 'Invoice not found');
  ok(res, withLines(t));
}));

async function createSale(client, body, userId) {
  const items = Array.isArray(body.items) ? body.items.filter((i) => Number(i.qty) > 0) : [];
  if (!items.length) throw httpError(400, 'Cart is empty');
  if (!body.branch_id) throw httpError(400, 'Select a branch');
  const branch = (await client.query('SELECT id, name, status FROM branches WHERE id = $1', [body.branch_id])).rows[0];
  if (!branch) throw httpError(400, 'Branch not found');

  const customerType = body.customer_type || (body.party_id ? 'patient' : 'walk_in');
  const payment = body.payment_method || 'Cash';
  let party = null;
  if (customerType === 'patient') {
    party = (await client.query(`SELECT * FROM parties WHERE id = $1 AND party_type = 'customer' FOR UPDATE`, [body.party_id])).rows[0];
    if (!party) throw httpError(400, 'Patient not found');
  }
  if (payment === 'Credit') {
    if (!party) throw httpError(400, 'Credit sale needs a registered patient (not Walk-in / Online Order)');
    if (!party.credit_allowed) throw httpError(400, `Credit is not allowed for ${party.name}. Enable it on the Patients page.`);
  }
  const online = customerType === 'online' ? (body.online || {}) : null;
  if (online && (!nn(online.customer_name) || !nn(online.phone) || !nn(online.address))) {
    throw httpError(400, 'Online order needs customer name, phone and delivery address');
  }
  const reqPct = Number(body.discount_pct) || 0;
  if (reqPct > 0) {
    const cp = (await client.query('SELECT max_discount_pct FROM company_profile WHERE id = 1')).rows[0];
    const maxPct = cp && cp.max_discount_pct !== null ? Number(cp.max_discount_pct) : 100;
    if (reqPct > maxPct) throw httpError(400, `Maximum discount allowed is ${maxPct}%`);
  }

  const doc = (await client.query(`SELECT fn_next_doc_no('sale') AS n`)).rows[0].n;
  const meta = { customer_type: customerType };
  if (online) meta.customer_name = online.customer_name;
  const txnId = (await client.query(
    `INSERT INTO transactions (doc_no, txn_type, party_id, branch_id, user_id, payment_method, status, meta)
     VALUES ($1,'sale',$2,$3,$4,$5,'Completed',$6) RETURNING id`,
    [doc, party ? party.id : null, branch.id, userId, payment, JSON.stringify(meta)])).rows[0].id;

  let subtotal = 0;
  for (const it of items) {
    const med = (await client.query(
      `SELECT m.*, u.name AS uom FROM v_medicines m LEFT JOIN lookups u ON u.id = m.uom_id WHERE m.id = $1`, [it.medicine_id])).rows[0];
    if (!med) throw httpError(400, 'Medicine not found');
    if (med.status !== 'Active') throw httpError(400, `${med.name} is inactive and cannot be sold`);
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty <= 0) throw httpError(400, `Enter a valid quantity for ${med.name}`);
    const salePrice = round2(Number(med.sale_price));
    const lineTotal = round2(salePrice * qty);
    const allocs = await allocateFEFO(client, { medicineId: med.id, branchId: branch.id, units: qty, preferredBatchId: nn(it.preferred_batch_id), medName: med.name, uom: med.uom });
    let left = lineTotal;
    for (let i = 0; i < allocs.length; i++) {
      const a = allocs[i];
      const amount = i === allocs.length - 1 ? round2(left) : round2(lineTotal * (a.qty / qty));
      left = round2(left - amount);
      await client.query(
        `INSERT INTO transaction_items (txn_id, medicine_id, batch_id, qty, unit_price, amount, meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [txnId, med.id, a.batch_id, a.qty, salePrice, amount,
          JSON.stringify({ sale_type: 'single', factor: 1, sale_unit_price: salePrice, unit_label: med.uom || 'Unit',
            unit_cost: a.unit_cost, batch_no: a.batch_no })]);
    }
    subtotal = round2(subtotal + lineTotal);
  }

  const pct = Math.min(Math.max(Number(body.discount_pct) || 0, 0), 100);
  const discount = round2(subtotal * pct / 100);
  const total = round2(subtotal - discount);
  await client.query('UPDATE transactions SET subtotal = $2, discount = $3, total = $4, meta = meta || $5 WHERE id = $1',
    [txnId, subtotal, discount, total, JSON.stringify({ discount_pct: pct })]);

  if (payment === 'Credit') {
    const newBal = round2(Number(party.balance) + total);
    if (Number(party.credit_limit) > 0 && newBal > Number(party.credit_limit)) {
      throw httpError(400, `Credit limit exceeded for ${party.name}: limit Rs. ${Number(party.credit_limit)}, balance would be Rs. ${newBal}`);
    }
    await client.query('UPDATE parties SET balance = $2 WHERE id = $1', [party.id, newBal]);
  }

  if (online) {
    const orderNo = (await client.query(`SELECT fn_next_code('online_orders','order_no','ORD-' || to_char(now(),'YYYY') || '-',4) AS n`)).rows[0].n;
    await client.query(
      `INSERT INTO online_orders (order_no, sale_txn_id, customer_name, phone, address, payment, rider, status, total, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'New',$8,$9)`,
      [orderNo, txnId, online.customer_name, online.phone, online.address, payment, nn(online.rider), total, branch.id]);
  }
  return txnId;
}

sales.post('/', authorize('pos', 'create'), asyncHandler(async (req, res) => {
  const id = await withTx((client) => createSale(client, req.body, req.user.id));
  ok(res, withLines(await getTxn(id)), 'Sale completed', 201);
}));

async function deleteSale(client, id) {
  const t = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'sale' FOR UPDATE`, [id])).rows[0];
  if (!t) throw httpError(404, 'Invoice not found');
  const ret = (await client.query(`SELECT doc_no FROM transactions WHERE ref_txn_id = $1 AND txn_type = 'sale_return'`, [id])).rows;
  if (ret.length) throw httpError(400, `This invoice has sale return(s) ${ret.map((r) => r.doc_no).join(', ')}. Delete the returns first.`);
  // A cancelled sale already had its stock and credit put back when it was cancelled
  if (t.status !== 'Cancelled') await restoreSale(client, t);
  await client.query('DELETE FROM transactions WHERE id = $1', [id]);
  return t;
}

async function restoreSale(client, t) {
  const items = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1', [t.id])).rows;
  for (const it of items) if (it.batch_id) await changeBatch(client, it.batch_id, Number(it.qty), 'Restoring stock');
  if (t.payment_method === 'Credit' && t.party_id) {
    await client.query('UPDATE parties SET balance = balance - $2 WHERE id = $1', [t.party_id, t.total]);
  }
}

async function cancelOrderSale(client, saleId) {
  const t = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'sale' FOR UPDATE`, [saleId])).rows[0];
  if (!t || t.status === 'Cancelled') return;
  const ret = (await client.query(`SELECT doc_no FROM transactions WHERE ref_txn_id = $1 AND txn_type = 'sale_return'`, [t.id])).rows;
  if (ret.length) throw httpError(400, `This order's invoice has sale return(s) ${ret.map((r) => r.doc_no).join(', ')}. Delete the returns first.`);
  await restoreSale(client, t);
  await client.query(`UPDATE transactions SET status = 'Cancelled' WHERE id = $1`, [t.id]);
}

sales.delete('/:id', authorize('sale-invoices', 'delete'), asyncHandler(async (req, res) => {
  const t = await withTx((client) => deleteSale(client, req.params.id));
  ok(res, { id: t.id }, `Invoice ${t.doc_no} deleted and stock restored`);
}));

const returns = express.Router();
returns.use(authenticate);

const RET_LIST = `
  SELECT t.id, t.doc_no, t.txn_date, t.status, t.total, t.ref_txn_id, s.doc_no AS invoice_no,
         COALESCE(p.name, s.meta->>'customer_name', 'Walk-in Customer') AS customer_name,
         t.branch_id, br.name AS branch_name, t.meta->>'refund_method' AS refund_method, t.meta->>'reason' AS reason,
         (SELECT string_agg(DISTINCT m.name, ', ') FROM transaction_items ti JOIN medicines m ON m.id = ti.medicine_id WHERE ti.txn_id = t.id) AS medicines,
         (SELECT string_agg(x.txt, ', ') FROM (
            SELECT m.name || ' × ' || ROUND(SUM(ti.qty) / COALESCE(NULLIF((ti.meta->>'factor')::numeric,0),1), 2)::text || ' ' || COALESCE(ti.meta->>'unit_label','') AS txt
            FROM transaction_items ti JOIN medicines m ON m.id = ti.medicine_id WHERE ti.txn_id = t.id
            GROUP BY m.name, ti.meta->>'factor', ti.meta->>'unit_label') x) AS qty_summary,
         (SELECT COALESCE(SUM(ti.qty / COALESCE(NULLIF((ti.meta->>'factor')::numeric,0),1)),0) FROM transaction_items ti WHERE ti.txn_id = t.id) AS qty
  FROM transactions t
  LEFT JOIN transactions s ON s.id = t.ref_txn_id
  LEFT JOIN parties p ON p.id = t.party_id
  LEFT JOIN branches br ON br.id = t.branch_id
  WHERE t.txn_type = 'sale_return'`;

returns.get('/', authorize('sale-returns', 'view'), asyncHandler(async (req, res) => {
  const params = [];
  const w = dateRange(params, 't.txn_date', req.query);
  ok(res, (await db.query(`${RET_LIST} ${w} ORDER BY t.id DESC`, params)).rows);
}));

returns.get('/:id', authorize('sale-returns', 'view'), asyncHandler(async (req, res) => {
  const t = await getTxn(req.params.id, 'sale_return');
  if (!t) throw httpError(404, 'Sale return not found');
  ok(res, t);
}));

returns.get('/invoice/:saleId/lines', authorize('sale-returns', 'create'), asyncHandler(async (req, res) => {
  const t = await getTxn(req.params.saleId, 'sale');
  if (!t) throw httpError(404, 'Invoice not found');
  const lines = invoiceLines(t.items);
  const returned = (await db.query(
    `SELECT ti.medicine_id, ti.meta->>'sale_type' AS sale_type, SUM(ti.qty) AS units
     FROM transaction_items ti JOIN transactions r ON r.id = ti.txn_id
     WHERE r.ref_txn_id = $1 AND r.txn_type = 'sale_return' GROUP BY 1,2`, [t.id])).rows;
  lines.forEach((l) => {
    const r = returned.find((x) => x.medicine_id === l.medicine_id && (x.sale_type || 'single') === l.sale_type);
    l.returned_qty = r ? round2(Number(r.units) / l.factor) : 0;
    l.returnable_qty = round2(l.qty - l.returned_qty);
  });
  ok(res, { invoice: { id: t.id, doc_no: t.doc_no, party_name: t.party_name || (t.meta && t.meta.customer_name) || 'Walk-in Customer', payment_method: t.payment_method, txn_date: t.txn_date }, lines });
}));

async function applyReturn(client, retId, sale, items) {
  let total = 0;
  const saleItems = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1 ORDER BY id', [sale.id])).rows;
  for (const it of items) {
    const qty = Number(it.qty);
    if (!(qty > 0)) continue;
    const lineRows = saleItems.filter((s) => s.medicine_id === Number(it.medicine_id) && ((s.meta || {}).sale_type || 'single') === (it.sale_type || 'single'));
    if (!lineRows.length) throw httpError(400, 'This medicine is not on the invoice');
    const meta = lineRows[0].meta || {};
    const factor = Number(meta.factor) || 1;
    const soldUnits = lineRows.reduce((s, r) => s + Number(r.qty), 0);
    const alreadyUnits = Number((await client.query(
      `SELECT COALESCE(SUM(ti.qty),0) AS u FROM transaction_items ti JOIN transactions r ON r.id = ti.txn_id
       WHERE r.ref_txn_id = $1 AND r.txn_type = 'sale_return' AND r.id <> $2 AND ti.medicine_id = $3 AND COALESCE(ti.meta->>'sale_type','single') = $4`,
      [sale.id, retId, it.medicine_id, it.sale_type || 'single'])).rows[0].u);
    let units = qty * factor;
    if (units > soldUnits - alreadyUnits + 0.0001) {
      throw httpError(400, `Cannot return ${qty}: only ${round2((soldUnits - alreadyUnits) / factor)} left to return on this invoice`);
    }
    const price = Number(meta.sale_unit_price) || 0;
    const discPct = Number((sale.meta || {}).discount_pct) || 0;
    const refundPerSaleUnit = round2(price * (1 - discPct / 100));
    for (const s of lineRows) {
      if (units <= 0) break;
      const take = Math.min(Number(s.qty), units);
      let batchId = s.batch_id;
      if (batchId) await changeBatch(client, batchId, take, 'Restock');
      else batchId = null;
      await client.query(
        `INSERT INTO transaction_items (txn_id, medicine_id, batch_id, qty, unit_price, amount, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [retId, s.medicine_id, batchId, take, round2(refundPerSaleUnit / factor * 10000) / 10000, round2(refundPerSaleUnit * take / factor),
          JSON.stringify({ sale_type: meta.sale_type || 'single', factor, unit_label: meta.unit_label, sale_unit_price: refundPerSaleUnit, batch_no: meta.batch_no })]);
      total = round2(total + refundPerSaleUnit * take / factor);
      units -= take;
    }
  }
  if (total <= 0) throw httpError(400, 'Enter a quantity to return');
  return total;
}

async function reverseReturn(client, ret) {
  const items = (await client.query('SELECT * FROM transaction_items WHERE txn_id = $1', [ret.id])).rows;
  for (const it of items) if (it.batch_id) await changeBatch(client, it.batch_id, -Number(it.qty), 'Undoing this return');
  if ((ret.meta || {}).credit_adjusted && ret.party_id) {
    await client.query('UPDATE parties SET balance = balance + $2 WHERE id = $1', [ret.party_id, ret.total]);
  }
  await client.query('DELETE FROM transaction_items WHERE txn_id = $1', [ret.id]);
}

async function saveReturn(client, body, userId, existingId) {
  requireFields(body, ['ref_txn_id']);
  const sale = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'sale' FOR UPDATE`, [body.ref_txn_id])).rows[0];
  if (!sale) throw httpError(400, 'Invoice not found');
  if (sale.status === 'Cancelled') throw httpError(400, 'This invoice belongs to a cancelled order and cannot be returned');
  const items = Array.isArray(body.items) ? body.items : [];
  let id = existingId;
  if (existingId) {
    const old = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'sale_return' FOR UPDATE`, [existingId])).rows[0];
    if (!old) throw httpError(404, 'Sale return not found');
    await reverseReturn(client, old);
  } else {
    const doc = (await client.query(`SELECT fn_next_doc_no('sale_return') AS n`)).rows[0].n;
    id = (await client.query(
      `INSERT INTO transactions (doc_no, txn_type, party_id, branch_id, user_id, ref_txn_id, status) VALUES ($1,'sale_return',$2,$3,$4,$5,'Completed') RETURNING id`,
      [doc, sale.party_id, sale.branch_id, userId, sale.id])).rows[0].id;
  }
  const total = await applyReturn(client, id, sale, items);
  const creditAdjusted = sale.payment_method === 'Credit' && !!sale.party_id;
  if (creditAdjusted) await client.query('UPDATE parties SET balance = balance - $2 WHERE id = $1', [sale.party_id, total]);
  await client.query(
    `UPDATE transactions SET ref_txn_id = $2, party_id = $3, branch_id = $4, subtotal = $5, total = $5, meta = $6 WHERE id = $1`,
    [id, sale.id, sale.party_id, sale.branch_id, total, JSON.stringify({
      refund_method: creditAdjusted ? 'Credit Adjustment' : (body.refund_method || 'Cash Refund'), reason: nn(body.reason), credit_adjusted: creditAdjusted })]);
  return id;
}

returns.post('/', authorize('sale-returns', 'create'), asyncHandler(async (req, res) => {
  const id = await withTx((client) => saveReturn(client, req.body, req.user.id));
  ok(res, await getTxn(id), 'Sale return saved', 201);
}));

returns.put('/:id', authorize('sale-returns', 'create'), asyncHandler(async (req, res) => {
  const id = await withTx((client) => saveReturn(client, req.body, req.user.id, Number(req.params.id)));
  ok(res, await getTxn(id), 'Sale return updated');
}));

returns.delete('/:id', authorize('sale-returns', 'delete'), asyncHandler(async (req, res) => {
  const doc = await withTx(async (client) => {
    const ret = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'sale_return' FOR UPDATE`, [req.params.id])).rows[0];
    if (!ret) throw httpError(404, 'Sale return not found');
    await reverseReturn(client, ret);
    await client.query('DELETE FROM transactions WHERE id = $1', [ret.id]);
    return ret.doc_no;
  });
  ok(res, { id: Number(req.params.id) }, `Sale return ${doc} deleted`);
}));

const orders = express.Router();
orders.use(authenticate);
const ORDER_STATUSES = ['New', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

const ORDER_LIST = `
  SELECT o.*, t.doc_no AS invoice_no, br.name AS branch_name,
    (SELECT COUNT(DISTINCT ti.medicine_id) FROM transaction_items ti WHERE ti.txn_id = o.sale_txn_id)::int AS item_count
  FROM online_orders o LEFT JOIN transactions t ON t.id = o.sale_txn_id LEFT JOIN branches br ON br.id = o.branch_id
  WHERE 1=1`;

orders.get('/', authorize('online-orders', 'view'), asyncHandler(async (req, res) => {
  const params = [];
  let w = dateRange(params, 'o.order_date', req.query);
  if (req.query.status && req.query.status !== 'All Status') { params.push(req.query.status); w += ` AND o.status = $${params.length}`; }
  ok(res, (await db.query(`${ORDER_LIST} ${w} ORDER BY o.id DESC`, params)).rows);
}));

orders.get('/:id', authorize('online-orders', 'view'), asyncHandler(async (req, res) => {
  const o = (await db.query(`${ORDER_LIST} AND o.id = $1`, [req.params.id])).rows[0];
  if (!o) throw httpError(404, 'Order not found');
  const t = o.sale_txn_id ? await getTxn(o.sale_txn_id) : null;
  o.items = t ? invoiceLines(t.items) : [];
  o.subtotal = t ? t.subtotal : o.total;
  o.discount = t ? t.discount : 0;
  ok(res, o);
}));

orders.put('/:id', authorize('online-orders', 'edit'), asyncHandler(async (req, res) => {
  const b = req.body;
  if (b.status && !ORDER_STATUSES.includes(b.status)) throw httpError(400, 'Invalid status');
  if (b.status === 'Out for Delivery') {
    const cur = (await db.query('SELECT rider FROM online_orders WHERE id = $1', [req.params.id])).rows[0];
    if (cur && !nn(cur.rider) && !nn(b.rider)) throw httpError(400, 'Assign a rider before sending the order out for delivery');
  }
  const msg = await withTx(async (client) => {
    const cur = (await client.query('SELECT * FROM online_orders WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Order not found');
    if (cur.status === 'Cancelled' && b.status && b.status !== 'Cancelled') throw httpError(400, 'A cancelled order cannot be reopened');
    const cancelling = b.status === 'Cancelled' && cur.status !== 'Cancelled';
    if (cancelling && cur.sale_txn_id) await cancelOrderSale(client, cur.sale_txn_id);
    await client.query(
      `UPDATE online_orders SET status = COALESCE($2, status), rider = COALESCE($3, rider),
         customer_name = COALESCE($4, customer_name), phone = COALESCE($5, phone), address = COALESCE($6, address)
       WHERE id = $1`,
      [cur.id, nn(b.status), nn(b.rider), nn(b.customer_name), nn(b.phone), nn(b.address)]);
    return cancelling ? `Order ${cur.order_no} cancelled and stock restored` : 'Order updated';
  });
  ok(res, (await db.query(`${ORDER_LIST} AND o.id = $1`, [req.params.id])).rows[0], msg);
}));

orders.delete('/:id', authorize('online-orders', 'delete'), asyncHandler(async (req, res) => {
  const o = await withTx(async (client) => {
    const cur = (await client.query('SELECT * FROM online_orders WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Order not found');
    if (cur.sale_txn_id) await deleteSale(client, cur.sale_txn_id);
    await client.query('DELETE FROM online_orders WHERE id = $1', [cur.id]);
    return cur;
  });
  ok(res, { id: o.id }, `Order ${o.order_no} deleted and stock restored`);
}));

module.exports = { sales, returns, orders, invoiceLines, getTxn };
