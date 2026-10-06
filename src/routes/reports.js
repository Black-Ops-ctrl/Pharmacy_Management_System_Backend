const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, dateRange } = require('../utils/helpers');
const { invoiceLines } = require('./sales');
const { LOW_STOCK_UNITS } = require('../services/stock');

router.use(authenticate);
const n = (v) => Number(v) || 0;

router.get('/dashboard', authorize('dashboard', 'view'), asyncHandler(async (req, res) => {
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const [s] = await q(`
    WITH stock AS (
      SELECT m.id,
        COALESCE((SELECT SUM(b.qty) FROM batches b WHERE b.medicine_id = m.id AND (b.expiry IS NULL OR b.expiry >= CURRENT_DATE)), 0) AS qty
      FROM medicines m WHERE m.status = 'Active')
    SELECT
      (SELECT COALESCE(SUM(total),0) FROM transactions WHERE txn_type = 'sale' AND status <> 'Cancelled' AND txn_date::date = CURRENT_DATE) AS today_sales,
      (SELECT COUNT(*) FROM transactions WHERE txn_type = 'sale' AND status <> 'Cancelled' AND txn_date::date = CURRENT_DATE) AS today_invoices,
      (SELECT COALESCE(SUM(ti.qty * COALESCE((ti.meta->>'unit_cost')::numeric, 0)),0) FROM transaction_items ti
         JOIN transactions t ON t.id = ti.txn_id WHERE t.txn_type = 'sale' AND t.status <> 'Cancelled' AND t.txn_date::date = CURRENT_DATE) AS today_cost,
      (SELECT COALESCE(SUM(total),0) FROM transactions WHERE txn_type = 'sale_return' AND txn_date::date = CURRENT_DATE) AS today_returns,
      (SELECT COUNT(*) FROM stock WHERE qty > 0 AND qty < ${LOW_STOCK_UNITS}) AS low_stock,
      (SELECT COUNT(*) FROM stock WHERE qty <= 0) AS out_of_stock,
      (SELECT COUNT(*) FROM transactions WHERE txn_type = 'purchase_order' AND status IN ('Draft','Sent','Partially Received')) AS pending_pos,
      (SELECT COUNT(*) FROM batches WHERE qty > 0 AND expiry < CURRENT_DATE) AS expired,
      (SELECT COUNT(*) FROM batches WHERE qty > 0 AND expiry >= CURRENT_DATE AND expiry <= CURRENT_DATE + 30) AS expiring_30,
      (SELECT COUNT(*) FROM batches WHERE qty > 0 AND expiry > CURRENT_DATE + 30 AND expiry <= CURRENT_DATE + 90) AS expiring_90,
      (SELECT COUNT(*) FROM batches WHERE qty > 0 AND (expiry IS NULL OR expiry > CURRENT_DATE + 90)) AS healthy,
      (SELECT COUNT(*) FROM online_orders WHERE order_date::date = CURRENT_DATE) AS today_online_orders`);

  const top = await q(`
    SELECT m.name, ROUND(SUM(ti.amount),2) AS revenue, SUM(ti.qty) AS units
    FROM transaction_items ti JOIN transactions t ON t.id = ti.txn_id JOIN medicines m ON m.id = ti.medicine_id
    WHERE t.txn_type = 'sale' AND t.status <> 'Cancelled' AND t.txn_date >= CURRENT_DATE - 29
    GROUP BY m.name ORDER BY revenue DESC LIMIT 15`);
  const trend = await q(`
    SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(SUM(t.total),0) AS total, COUNT(t.id)::int AS invoices
    FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
    LEFT JOIN transactions t ON t.txn_type = 'sale' AND t.status <> 'Cancelled' AND t.txn_date::date = d::date
    GROUP BY d ORDER BY d`);
  const pay = await q(`
    SELECT payment_method AS method, SUM(total) AS total, COUNT(*)::int AS invoices
    FROM transactions WHERE txn_type = 'sale' AND status <> 'Cancelled' AND txn_date >= CURRENT_DATE - 29
    GROUP BY payment_method ORDER BY total DESC`);
  const payTotal = pay.reduce((a, p) => a + n(p.total), 0) || 1;
  const maxRev = n(top[0] && top[0].revenue) || 1;

  ok(res, {
    stats: {
      today_sales: n(s.today_sales), today_invoices: n(s.today_invoices),
      today_profit: Math.round((n(s.today_sales) - n(s.today_cost)) * 100) / 100,
      today_returns: n(s.today_returns), low_stock: n(s.low_stock), out_of_stock: n(s.out_of_stock),
      pending_pos: n(s.pending_pos), expired: n(s.expired), expiring_30: n(s.expiring_30),
      today_online_orders: n(s.today_online_orders),
    },
    top_medicines: top.map((t) => ({ name: t.name, revenue: n(t.revenue), units: n(t.units), percentage: Math.round((n(t.revenue) / maxRev) * 100) })),
    sales_trend: trend.map((t) => ({ day: t.day, total: n(t.total), invoices: t.invoices })),
    payment_methods: pay.map((p) => ({ method: p.method || 'Other', total: n(p.total), percentage: Math.round((n(p.total) / payTotal) * 100) })),
    expiry: { expired: n(s.expired), within_30: n(s.expiring_30), within_90: n(s.expiring_90), healthy: n(s.healthy) },
  });
}));

router.get('/analytics', authorize('reports', 'view'), asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) throw httpError(400, 'Select a From and To date');
  if (from > to) throw httpError(400, '"From" date must be before "To" date');
  const q = async (sql, p) => (await db.query(sql, p)).rows;
  const P = [from, to];
  const [sum] = await q(`
    SELECT
      (SELECT COALESCE(SUM(total),0) FROM transactions WHERE txn_type='sale' AND status <> 'Cancelled' AND txn_date::date BETWEEN $1 AND $2) AS total_sales,
      (SELECT COUNT(*) FROM transactions WHERE txn_type='sale' AND status <> 'Cancelled' AND txn_date::date BETWEEN $1 AND $2) AS invoices,
      (SELECT COALESCE(SUM(total),0) FROM transactions WHERE txn_type='grn' AND txn_date::date BETWEEN $1 AND $2) AS total_purchases,
      (SELECT COALESCE(SUM(total),0) FROM transactions WHERE txn_type='sale_return' AND txn_date::date BETWEEN $1 AND $2) AS total_returns,
      (SELECT COALESCE(SUM(ti.qty * COALESCE((ti.meta->>'unit_cost')::numeric,0)),0) FROM transaction_items ti JOIN transactions t ON t.id = ti.txn_id
         WHERE t.txn_type='sale' AND t.status <> 'Cancelled' AND t.txn_date::date BETWEEN $1 AND $2) AS cost_of_sales`, P);
  const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  const byMonth = days > 62;
  const bucket = byMonth ? `to_char(d, 'YYYY-MM')` : `to_char(d, 'YYYY-MM-DD')`;
  const trend = await q(`
    WITH d AS (SELECT generate_series($1::date, $2::date, '1 day')::date AS d)
    SELECT ${bucket} AS day,
      COALESCE(SUM((SELECT COALESCE(SUM(total),0) FROM transactions WHERE txn_type='sale' AND status <> 'Cancelled' AND txn_date::date = d.d)),0) AS sales,
      COALESCE(SUM((SELECT COALESCE(SUM(total),0) FROM transactions WHERE txn_type='grn' AND txn_date::date = d.d)),0) AS purchases
    FROM d GROUP BY 1 ORDER BY 1`, P);
  const top = await q(`
    SELECT m.name, SUM(ti.qty / COALESCE(NULLIF((ti.meta->>'factor')::numeric,0),1)) AS qty, SUM(ti.qty) AS units, SUM(ti.amount) AS revenue
    FROM transaction_items ti JOIN transactions t ON t.id = ti.txn_id JOIN medicines m ON m.id = ti.medicine_id
    WHERE t.txn_type='sale' AND t.status <> 'Cancelled' AND t.txn_date::date BETWEEN $1 AND $2
    GROUP BY m.name ORDER BY units DESC LIMIT 6`, P);
  const pay = await q(`
    SELECT COALESCE(payment_method,'Other') AS name, SUM(total) AS total FROM transactions
    WHERE txn_type='sale' AND status <> 'Cancelled' AND txn_date::date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 2 DESC`, P);
  const payTotal = pay.reduce((a, p) => a + n(p.total), 0) || 1;
  const branch = await q(`
    SELECT COALESCE(br.name,'No branch') AS branch, SUM(t.total) AS sales FROM transactions t LEFT JOIN branches br ON br.id = t.branch_id
    WHERE t.txn_type='sale' AND t.status <> 'Cancelled' AND t.txn_date::date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 2 DESC`, P);
  const invoices = await q(`
    SELECT t.doc_no AS invoice, to_char(t.txn_date,'YYYY-MM-DD') AS date, COALESCE(br.name,'') AS branch, t.payment_method AS payment, t.total
    FROM transactions t LEFT JOIN branches br ON br.id = t.branch_id
    WHERE t.txn_type='sale' AND t.status <> 'Cancelled' AND t.txn_date::date BETWEEN $1 AND $2 ORDER BY t.id DESC LIMIT 40`, P);

  ok(res, {
    summary: {
      total_sales: n(sum.total_sales), invoices: n(sum.invoices), total_purchases: n(sum.total_purchases),
      total_returns: n(sum.total_returns), gross_profit: Math.round((n(sum.total_sales) - n(sum.cost_of_sales) - n(sum.total_returns)) * 100) / 100,
    },
    trend: trend.map((t) => ({ day: byMonth ? t.day : t.day.slice(5), sales: n(t.sales), purchases: n(t.purchases) })),
    top_medicines: top.map((t) => ({ name: t.name, qty: Math.round(n(t.qty) * 100) / 100, units: n(t.units), revenue: n(t.revenue) })),
    payment_split: pay.map((p) => ({ name: p.name, value: Math.round((n(p.total) / payTotal) * 100), total: n(p.total) })),
    branch_sales: branch.map((b) => ({ branch: b.branch, sales: n(b.sales) })),
    invoices: invoices.map((i) => ({ ...i, total: n(i.total) })),
  });
}));

const DOC_TYPES = {
  'sale-invoices': 'sale', 'sale-returns': 'sale_return', 'purchases': 'purchase_order', 'grn': 'grn', 'purchase-returns': 'purchase_return',
};

router.get('/documents', authorize('reports', 'view'), asyncHandler(async (req, res) => {
  const type = DOC_TYPES[req.query.type] || req.query.type;
  if (!Object.values(DOC_TYPES).includes(type)) throw httpError(400, 'Unknown report type');
  const params = [type];
  const w = dateRange(params, 't.txn_date', req.query);
  const rows = (await db.query(`
    SELECT t.id, t.doc_no AS ref, to_char(t.txn_date,'YYYY-MM-DD') AS date, t.status,
      COALESCE(p.name, t.meta->>'customer_name', CASE WHEN t.txn_type IN ('sale','sale_return') THEN 'Walk-in Customer' END, '') AS party,
      COALESCE(br.name,'') AS branch, COALESCE(t.payment_method,'') AS payment, t.total AS amount,
      rt.doc_no AS invoice, COALESCE(t.meta->>'refund_method', '') AS refund, COALESCE(t.meta->>'reason','') AS reason,
      (SELECT COUNT(*) FROM transaction_items ti WHERE ti.txn_id = t.id)::int AS count,
      (SELECT string_agg(DISTINCT m.name, ', ') FROM transaction_items ti JOIN medicines m ON m.id = ti.medicine_id WHERE ti.txn_id = t.id) AS medicine,
      (SELECT ROUND(SUM(ti.qty / COALESCE(NULLIF((ti.meta->>'factor')::numeric,0),1)),2) FROM transaction_items ti WHERE ti.txn_id = t.id) AS qty,
      (SELECT string_agg(COALESCE(b.batch_no, ti.meta->>'batch_no'), ', ') FROM transaction_items ti LEFT JOIN batches b ON b.id = ti.batch_id WHERE ti.txn_id = t.id) AS batch
    FROM transactions t LEFT JOIN parties p ON p.id = t.party_id LEFT JOIN branches br ON br.id = t.branch_id
    LEFT JOIN transactions rt ON rt.id = t.ref_txn_id
    WHERE t.txn_type = $1 ${w} ORDER BY t.txn_date, t.id`, params)).rows.map((r) => ({ ...r, amount: n(r.amount), qty: n(r.qty) }));
  ok(res, rows);
}));

router.get('/documents/:id', authorize('reports', 'view'), asyncHandler(async (req, res) => {
  const t = (await db.query('SELECT fn_get_transaction($1) AS t', [req.params.id])).rows[0].t;
  if (!t) throw httpError(404, 'Document not found');
  const lines = ['sale', 'sale_return'].includes(t.txn_type)
    ? invoiceLines(t.items).map((l) => ({ medicine: l.medicine, batch: l.batch, qty: l.qty, price: l.price, amount: l.amount }))
    : t.items.map((i) => ({ medicine: i.medicine, batch: i.batch_no || '', qty: n(i.qty), price: n(i.unit_price), amount: n(i.amount) }));
  ok(res, { ...t, lines });
}));

module.exports = router;
