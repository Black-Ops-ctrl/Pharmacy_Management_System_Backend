const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, requireFields, withTx, nn, dateRange } = require('../utils/helpers');

router.use(authenticate);
const STATUSES = ['Pending', 'Partially Dispensed', 'Dispensed', 'Expired'];

const LIST = `
  SELECT t.id, t.doc_no, t.txn_date AS rx_date, t.status, t.notes, t.party_id, p.name AS patient_name, p.code AS patient_code,
         p.phone AS patient_phone, t.meta->>'doctor' AS doctor, t.meta->>'hospital' AS hospital,
         (SELECT COUNT(*) FROM transaction_items ti WHERE ti.txn_id = t.id)::int AS item_count,
         (SELECT string_agg(m.name, ', ' ORDER BY ti.id) FROM transaction_items ti JOIN medicines m ON m.id = ti.medicine_id WHERE ti.txn_id = t.id) AS medicines
  FROM transactions t LEFT JOIN parties p ON p.id = t.party_id
  WHERE t.txn_type = 'prescription'`;

router.get('/', authorize('prescriptions', 'view'), asyncHandler(async (req, res) => {
  const params = [];
  let w = dateRange(params, 't.txn_date', req.query);
  if (req.query.status && req.query.status !== 'All Status') { params.push(req.query.status); w += ` AND t.status = $${params.length}`; }
  ok(res, (await db.query(`${LIST} ${w} ORDER BY t.txn_date DESC, t.id DESC`, params)).rows);
}));

router.get('/:id', authorize('prescriptions', 'view'), asyncHandler(async (req, res) => {
  const t = (await db.query('SELECT fn_get_transaction($1) AS t', [req.params.id])).rows[0].t;
  if (!t || t.txn_type !== 'prescription') throw httpError(404, 'Prescription not found');
  ok(res, t);
}));

async function save(client, b, userId, id) {
  requireFields(b, ['party_id', 'doctor']);
  const p = (await client.query(`SELECT id FROM parties WHERE id = $1 AND party_type = 'customer'`, [b.party_id])).rows[0];
  if (!p) throw httpError(400, 'Select a valid patient');
  const items = (b.items || []).filter((i) => i.medicine_id);
  if (!items.length) throw httpError(400, 'Add at least one medicine');
  const status = b.status || 'Pending';
  if (!STATUSES.includes(status)) throw httpError(400, 'Invalid status');
  const meta = JSON.stringify({ doctor: String(b.doctor).trim(), hospital: nn(b.hospital) });
  if (id) {
    const { rowCount } = await client.query(
      `UPDATE transactions SET party_id = $2, status = $3, notes = $4, meta = $5, txn_date = COALESCE($6::timestamptz, txn_date)
       WHERE id = $1 AND txn_type = 'prescription'`, [id, b.party_id, status, nn(b.notes), meta, nn(b.rx_date)]);
    if (!rowCount) throw httpError(404, 'Prescription not found');
    await client.query('DELETE FROM transaction_items WHERE txn_id = $1', [id]);
  } else {
    const doc = (await client.query(`SELECT fn_next_doc_no('prescription') AS n`)).rows[0].n;
    id = (await client.query(
      `INSERT INTO transactions (doc_no, txn_type, party_id, user_id, status, notes, meta, txn_date)
       VALUES ($1,'prescription',$2,$3,$4,$5,$6,COALESCE($7::timestamptz, now())) RETURNING id`,
      [doc, b.party_id, userId, status, nn(b.notes), meta, nn(b.rx_date)])).rows[0].id;
  }
  for (const it of items) {
    await client.query(
      `INSERT INTO transaction_items (txn_id, medicine_id, qty, description, meta) VALUES ($1,$2,$3,$4,$5)`,
      [id, it.medicine_id, Number(it.qty) || 1, nn(it.dosage), JSON.stringify({ dosage: nn(it.dosage), dispensed: Number(it.dispensed) || 0 })]);
  }
  return id;
}

const detail = async (id) => (await db.query('SELECT fn_get_transaction($1) AS t', [id])).rows[0].t;

router.post('/', authorize('prescriptions', 'create'), asyncHandler(async (req, res) => {
  const id = await withTx((c) => save(c, req.body, req.user.id));
  ok(res, await detail(id), 'Prescription saved', 201);
}));
router.put('/:id', authorize('prescriptions', 'edit'), asyncHandler(async (req, res) => {
  const id = await withTx((c) => save(c, req.body, req.user.id, Number(req.params.id)));
  ok(res, await detail(id), 'Prescription updated');
}));
router.delete('/:id', authorize('prescriptions', 'delete'), asyncHandler(async (req, res) => {
  const { rows } = await db.query(`DELETE FROM transactions WHERE id = $1 AND txn_type = 'prescription' RETURNING doc_no`, [req.params.id]);
  if (!rows[0]) throw httpError(404, 'Prescription not found');
  ok(res, { id: Number(req.params.id) }, `Prescription ${rows[0].doc_no} deleted`);
}));

module.exports = router;
