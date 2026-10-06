const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, requireFields, withTx, nn, dateRange } = require('../utils/helpers');
const { round2 } = require('../services/stock');

router.use(authenticate);

const STATUS = `CASE WHEN p.balance <= 0 THEN 'Clear'
  WHEN p.credit_limit > 0 AND p.balance > p.credit_limit THEN 'Over Limit'
  WHEN p.credit_limit > 0 AND p.balance > p.credit_limit * 0.8 THEN 'Near Limit'
  ELSE 'Within Limit' END`;

const ACCOUNT = `
  SELECT p.id, p.code, p.name AS customer, p.phone, p.city, p.credit_allowed, p.credit_limit, p.balance, ${STATUS} AS status,
    (SELECT MAX(t.txn_date) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'credit_payment') AS last_payment,
    (SELECT MAX(t.txn_date) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'sale' AND t.payment_method = 'Credit') AS last_credit_sale,
    (SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'sale' AND t.payment_method = 'Credit') AS total_credit_sales,
    (SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'credit_payment') AS total_paid
  FROM parties p WHERE p.party_type = 'customer'`;

router.get('/', authorize('credit', 'view'), asyncHandler(async (req, res) => {
  const params = [];
  let w = ' AND (p.credit_allowed OR p.balance <> 0)';
  if (req.query.from || req.query.to) {
    w += ` AND EXISTS (SELECT 1 FROM transactions t WHERE t.party_id = p.id AND ((t.txn_type = 'sale' AND t.payment_method = 'Credit') OR t.txn_type = 'credit_payment')${dateRange(params, 't.txn_date', req.query)})`;
  }
  ok(res, (await db.query(`${ACCOUNT} ${w} ORDER BY p.balance DESC, p.name`, params)).rows);
}));

router.get('/:partyId', authorize('credit', 'view'), asyncHandler(async (req, res) => {
  const a = (await db.query(`${ACCOUNT} AND p.id = $1`, [req.params.partyId])).rows[0];
  if (!a) throw httpError(404, 'Credit account not found');
  const params = [req.params.partyId];
  const range = dateRange(params, 't.txn_date', req.query);
  a.entries = (await db.query(
    `SELECT t.id, t.doc_no AS ref, t.txn_date AS date, t.txn_type, t.payment_method,
            CASE WHEN t.txn_type = 'sale' THEN 'Credit Sale' WHEN t.txn_type = 'sale_return' THEN 'Sale Return'
                 ELSE 'Payment' END AS type,
            CASE WHEN t.txn_type = 'sale' THEN t.total ELSE -t.total END AS amount, t.notes
     FROM transactions t
     WHERE t.party_id = $1 AND ((t.txn_type = 'sale' AND t.payment_method = 'Credit')
        OR t.txn_type = 'credit_payment' OR (t.txn_type = 'sale_return' AND (t.meta->>'credit_adjusted')::boolean)) ${range}
     ORDER BY t.txn_date DESC, t.id DESC`, params)).rows;
  ok(res, a);
}));

router.put('/:partyId', authorize('credit', 'edit'), asyncHandler(async (req, res) => {
  const lim = nn(req.body.credit_limit);
  if (lim !== null && !(Number(lim) >= 0)) throw httpError(400, 'Credit limit must be 0 or more');
  const { rowCount } = await db.query(
    `UPDATE parties SET credit_limit = COALESCE($2, credit_limit), credit_allowed = COALESCE($3, credit_allowed)
     WHERE id = $1 AND party_type = 'customer'`,
    [req.params.partyId, lim, req.body.credit_allowed === undefined ? null : !!req.body.credit_allowed]);
  if (!rowCount) throw httpError(404, 'Credit account not found');
  ok(res, (await db.query(`${ACCOUNT} AND p.id = $1`, [req.params.partyId])).rows[0], 'Credit account updated');
}));

router.delete('/:partyId', authorize('credit', 'delete'), asyncHandler(async (req, res) => {
  const p = (await db.query(`SELECT name, balance FROM parties WHERE id = $1 AND party_type = 'customer'`, [req.params.partyId])).rows[0];
  if (!p) throw httpError(404, 'Credit account not found');
  if (Number(p.balance) !== 0) throw httpError(400, `${p.name} still owes Rs. ${Number(p.balance)}. Receive the payment before closing the account.`);
  await db.query('UPDATE parties SET credit_allowed = false, credit_limit = 0 WHERE id = $1', [req.params.partyId]);
  ok(res, { id: Number(req.params.partyId) }, `Credit account of ${p.name} closed`);
}));

router.post('/payments', authorize('credit', 'create'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['party_id', 'amount']);
  const amt = round2(Number(req.body.amount));
  if (!(amt > 0)) throw httpError(400, 'Enter a valid amount');
  const out = await withTx(async (client) => {
    const p = (await client.query(`SELECT * FROM parties WHERE id = $1 AND party_type = 'customer' FOR UPDATE`, [req.body.party_id])).rows[0];
    if (!p) throw httpError(404, 'Credit account not found');
    if (amt > Number(p.balance) + 0.001) throw httpError(400, `Amount is more than the outstanding balance (Rs. ${Number(p.balance)})`);
    const method = req.body.method || 'Cash';
    const doc = (await client.query(`SELECT fn_next_doc_no('credit_payment') AS n`)).rows[0].n;
    const id = (await client.query(
      `INSERT INTO transactions (doc_no, txn_type, party_id, user_id, status, payment_method, subtotal, total, notes)
       VALUES ($1,'credit_payment',$2,$3,'Completed',$4,$5,$5,$6) RETURNING id`,
      [doc, p.id, req.user.id, method, amt, nn(req.body.note)])).rows[0].id;
    await client.query('UPDATE parties SET balance = balance - $2 WHERE id = $1', [p.id, amt]);
    await client.query(
      `INSERT INTO finance_entries (ref, entry_type, category, method, amount, note, source_txn_id, user_id)
       VALUES (fn_next_code('finance_entries','ref','TXN-' || to_char(now(),'YYYY') || '-',4),'Income','Credit Recovery',$1,$2,$3,$4,$5)`,
      [method, amt, `Credit payment ${doc} — ${p.name}`, id, req.user.id]);
    return { id, doc_no: doc };
  });
  ok(res, out, `Payment ${out.doc_no} received`, 201);
}));

router.delete('/payments/:id', authorize('credit', 'delete'), asyncHandler(async (req, res) => {
  const doc = await withTx(async (client) => {
    const t = (await client.query(`SELECT * FROM transactions WHERE id = $1 AND txn_type = 'credit_payment' FOR UPDATE`, [req.params.id])).rows[0];
    if (!t) throw httpError(404, 'Payment not found');
    await client.query('UPDATE parties SET balance = balance + $2 WHERE id = $1', [t.party_id, t.total]);
    await client.query('DELETE FROM transactions WHERE id = $1', [t.id]);
    return t.doc_no;
  });
  ok(res, { id: Number(req.params.id) }, `Payment ${doc} deleted`);
}));

module.exports = router;
