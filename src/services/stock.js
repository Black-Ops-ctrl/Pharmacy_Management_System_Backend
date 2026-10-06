const { httpError } = require('../utils/helpers');

const LOW_STOCK_UNITS = 5;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const fmtQty = (n) => String(round2(n));

async function changeBatch(client, batchId, delta, what = 'This change') {
  const b = (await client.query(
    `SELECT b.*, m.name AS medicine FROM batches b JOIN medicines m ON m.id = b.medicine_id WHERE b.id = $1 FOR UPDATE OF b`,
    [batchId])).rows[0];
  if (!b) throw httpError(400, 'Batch not found (it may have been deleted)');
  const next = Number(b.qty) + Number(delta);
  if (next < -0.0001) {
    throw httpError(400, `${what} needs ${fmtQty(Math.abs(delta))} units from batch ${b.batch_no} (${b.medicine}) but only ${fmtQty(b.qty)} are in stock`);
  }
  await client.query('UPDATE batches SET qty = $2 WHERE id = $1', [batchId, round2(Math.max(0, next))]);
  return b;
}

async function allocateFEFO(client, { medicineId, branchId, units, preferredBatchId, medName, uom }) {
  const rows = (await client.query(
    `SELECT * FROM batches
     WHERE medicine_id = $1 AND qty > 0 AND (expiry IS NULL OR expiry >= CURRENT_DATE)
       AND ($2::int IS NULL OR branch_id = $2 OR branch_id IS NULL)
     ORDER BY (CASE WHEN id = $3 THEN 0 ELSE 1 END), expiry NULLS LAST, id
     FOR UPDATE`,
    [medicineId, branchId || null, preferredBatchId || null])).rows;
  const available = rows.reduce((s, b) => s + Number(b.qty), 0);
  const name = medName || 'This medicine';
  if (available <= 0) throw httpError(400, `${name} is out of stock`);
  if (available + 0.0001 < units) {
    throw httpError(400, `Only ${fmtQty(available)} ${uom || 'units'} of ${name} available, ${fmtQty(units)} needed`);
  }
  const out = [];
  let need = units;
  for (const b of rows) {
    if (need <= 0) break;
    const take = Math.min(Number(b.qty), need);
    await client.query('UPDATE batches SET qty = qty - $2 WHERE id = $1', [b.id, take]);
    out.push({ batch_id: b.id, qty: take, unit_cost: Number(b.unit_cost), batch_no: b.batch_no, expiry: b.expiry });
    need -= take;
  }
  return out;
}

const ADJ_TYPES = ['Damage', 'Expiry Write-off', 'Theft / Loss', 'Count Correction', 'Return to Supplier', 'Stock Cleared'];
const signedDelta = (type, qty) => {
  const n = Number(qty);
  if (!Number.isFinite(n) || n === 0) throw httpError(400, 'Quantity must be a non-zero number');
  return type === 'Count Correction' ? n : -Math.abs(n);
};

const expiryDate = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${s}-${String(last).padStart(2, '0')}`;
  }
  return s.slice(0, 10);
};

const stockStatusSql = (qtyExpr) =>
  `CASE WHEN ${qtyExpr} <= 0 THEN 'Out of Stock' WHEN ${qtyExpr} < ${LOW_STOCK_UNITS} THEN 'Low Stock' ELSE 'In Stock' END`;

module.exports = { LOW_STOCK_UNITS, stockStatusSql, expiryDate, round2, changeBatch, allocateFEFO, ADJ_TYPES, signedDelta };
