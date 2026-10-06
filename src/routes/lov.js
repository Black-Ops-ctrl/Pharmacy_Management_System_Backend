const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ok } = require('../utils/helpers');

router.use(authenticate);
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;

router.get('/branches', asyncHandler(async (req, res) =>
  ok(res, await rows(`SELECT id, code, name, city, address, phone FROM branches WHERE status <> 'Closed' OR $1::boolean ORDER BY id`, [req.query.all === '1']))));
router.get('/cities', asyncHandler(async (req, res) =>
  ok(res, await rows(`SELECT id, name FROM cities ORDER BY name`))));
router.get('/categories', asyncHandler(async (req, res) =>
  ok(res, await rows(`SELECT id, name FROM lookups WHERE kind = 'category' ORDER BY name`))));
router.get('/uoms', asyncHandler(async (req, res) =>
  ok(res, await rows(`SELECT id, name, symbol FROM lookups WHERE kind = 'uom' ORDER BY name`))));
router.get('/suppliers', asyncHandler(async (req, res) =>
  ok(res, await rows(`SELECT id, code, name, phone, city, status FROM parties WHERE party_type = 'supplier' AND status <> 'Blacklisted' ORDER BY name`))));
router.get('/customers', asyncHandler(async (req, res) =>
  ok(res, await rows(`SELECT id, code, name, phone, city, credit_allowed, credit_limit, balance FROM parties
                      WHERE party_type = 'customer' AND status = 'Active' ORDER BY name`))));
router.get('/employees', asyncHandler(async (req, res) =>
  ok(res, await rows(`SELECT e.id, e.name, e.job_role, e.branch_id FROM employees e WHERE e.status = 'Active' ORDER BY e.name`))));

router.get('/medicines', asyncHandler(async (req, res) => {
  const branch = req.query.branch_id || null;
  const meds = await rows(`
    SELECT m.id, m.code, m.name, m.generic, m.category_id, m.category_name, m.uom_id, m.uom_name, m.pack_type,
           m.box_size, m.pack_size, m.price, m.discount, m.sale_price, m.barcode, m.status,
           COALESCE((SELECT SUM(b.qty) FROM batches b WHERE b.medicine_id = m.id AND b.qty > 0
                     AND (b.expiry IS NULL OR b.expiry >= CURRENT_DATE)
                     AND ($1::int IS NULL OR b.branch_id = $1 OR b.branch_id IS NULL)), 0) AS stock
    FROM v_medicines m WHERE ($2::boolean OR m.status = 'Active') ORDER BY m.name`, [branch, req.query.all === '1']);
  if (req.query.with_batches === '1') {
    const bs = await rows(`
      SELECT b.id, b.medicine_id, b.batch_no, b.expiry, b.qty FROM batches b
      WHERE b.qty > 0 AND (b.expiry IS NULL OR b.expiry >= CURRENT_DATE) AND ($1::int IS NULL OR b.branch_id = $1 OR b.branch_id IS NULL)
      ORDER BY b.expiry NULLS LAST, b.id`, [branch]);
    const map = {};
    bs.forEach((b) => { (map[b.medicine_id] = map[b.medicine_id] || []).push(b); });
    meds.forEach((m) => { m.batches = map[m.id] || []; });
  }
  ok(res, meds);
}));

router.get('/batches', asyncHandler(async (req, res) => {
  ok(res, await rows(`
    SELECT b.id, b.batch_no, b.expiry, b.qty, b.unit_cost, b.medicine_id, m.name AS medicine_name, b.branch_id, br.name AS branch_name,
           b.supplier_id, s.name AS supplier_name
    FROM batches b JOIN medicines m ON m.id = b.medicine_id LEFT JOIN branches br ON br.id = b.branch_id LEFT JOIN parties s ON s.id = b.supplier_id
    WHERE (b.qty > 0 OR $4::int = b.id)
      AND ($1::int IS NULL OR b.medicine_id = $1) AND ($2::int IS NULL OR b.branch_id = $2) AND ($3::int IS NULL OR b.supplier_id = $3)
    ORDER BY m.name, b.expiry NULLS LAST`,
  [req.query.medicine_id || null, req.query.branch_id || null, req.query.supplier_id || null, req.query.include_id || null]));
}));

router.get('/purchase-orders', asyncHandler(async (req, res) => {
  ok(res, await rows(`
    SELECT t.id, t.doc_no, t.party_id, p.name AS supplier_name, t.status
    FROM transactions t LEFT JOIN parties p ON p.id = t.party_id
    WHERE t.txn_type = 'purchase_order' AND (t.status IN ('Draft','Sent','Partially Received') OR t.id = $1::int)
    ORDER BY t.id DESC`, [req.query.include_id || null]));
}));
router.get('/purchase-orders/:id/items', asyncHandler(async (req, res) => {
  ok(res, await rows(`
    SELECT ti.medicine_id, m.name AS medicine_name, ti.qty AS ordered, ti.unit_price AS unit_cost,
      COALESCE((SELECT SUM(gi.qty) FROM transaction_items gi JOIN transactions g ON g.id = gi.txn_id
                WHERE g.ref_txn_id = ti.txn_id AND g.txn_type = 'grn' AND gi.medicine_id = ti.medicine_id), 0) AS received
    FROM transaction_items ti JOIN medicines m ON m.id = ti.medicine_id WHERE ti.txn_id = $1 ORDER BY ti.id`, [req.params.id]));
}));

router.get('/sales', asyncHandler(async (req, res) => {
  ok(res, await rows(`
    SELECT t.id, t.doc_no, t.txn_date, t.total, t.payment_method, COALESCE(p.name, t.meta->>'customer_name', 'Walk-in Customer') AS customer_name
    FROM transactions t LEFT JOIN parties p ON p.id = t.party_id
    WHERE t.txn_type = 'sale' AND t.status <> 'Cancelled' ORDER BY t.id DESC LIMIT 500`));
}));

module.exports = router;
