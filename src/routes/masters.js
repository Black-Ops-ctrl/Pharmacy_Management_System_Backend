const db = require('../config/db');
const makeCrud = require('../utils/crud');
const { httpError, dateRange } = require('../utils/helpers');

const inUse = async (sql, id, msg) => {
  const n = (await db.query(sql, [id])).rows[0].n;
  if (Number(n) > 0) throw httpError(400, msg);
};

const branches = makeCrud({
  table: 'branches', pageKey: 'branches', label: 'Branch',
  fields: ['name', 'city', 'address', 'phone', 'manager', 'status'], required: ['name'],
  codePrefix: 'BR-', codeWidth: 3,
  beforeDelete: (id) => inUse(`SELECT (SELECT COUNT(*) FROM transactions WHERE branch_id = $1) + (SELECT COUNT(*) FROM batches WHERE branch_id = $1) AS n`, id,
    'This branch has stock or transactions and cannot be deleted. Set its status to "Closed" instead.'),
  listSql: () => `
    SELECT b.*,
      (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id AND e.status <> 'Terminated')::int AS staff,
      (SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE t.branch_id = b.id AND t.txn_type = 'sale' AND t.status <> 'Cancelled'
         AND t.txn_date::date = CURRENT_DATE) AS today_sales
    FROM branches b ORDER BY b.id`,
});

const cities = makeCrud({
  table: 'cities', pageKey: 'cities', label: 'City',
  fields: ['name', 'status'], required: ['name'], orderBy: 'name',
  transform: (b) => ({ ...b, name: b.name !== undefined ? String(b.name).trim() : undefined }),
  beforeUpdate: async (id, body) => {
    if (!body.name) return;
    const old = (await db.query('SELECT name FROM cities WHERE id = $1', [id])).rows[0];
    if (!old || old.name === body.name) return;
    await db.query('UPDATE parties SET city = $2 WHERE city = $1', [old.name, body.name]);
    await db.query('UPDATE branches SET city = $2 WHERE city = $1', [old.name, body.name]);
  },
  beforeDelete: async (id) => {
    const c = (await db.query('SELECT name FROM cities WHERE id = $1', [id])).rows[0];
    if (!c) return;
    await inUse(`SELECT (SELECT COUNT(*) FROM parties WHERE city = $1) + (SELECT COUNT(*) FROM branches WHERE city = $1) AS n`,
      c.name, `"${c.name}" is used by patients, suppliers or branches and cannot be deleted`);
  },
  listSql: () => `
    SELECT c.*,
      (SELECT COUNT(*) FROM parties p WHERE p.city = c.name AND p.party_type = 'customer')::int AS patients,
      (SELECT COUNT(*) FROM parties p WHERE p.city = c.name AND p.party_type = 'supplier')::int AS suppliers,
      (SELECT COUNT(*) FROM branches b WHERE b.city = c.name)::int AS branches
    FROM cities c ORDER BY c.name`,
});

const lookup = (kind, pageKey, label) => makeCrud({
  table: 'lookups', pageKey, label,
  fields: ['name', 'symbol', 'kind'], required: ['name'],
  transform: (b) => ({ ...b, kind }),
  listSql: (params) => { params.push(kind); return `
    SELECT l.*, (SELECT COUNT(*) FROM medicines m WHERE m.${kind === 'uom' ? 'uom_id' : 'category_id'} = l.id)::int AS medicines
    FROM lookups l WHERE l.kind = $1 ORDER BY l.name`; },
  getSql: `SELECT * FROM lookups WHERE id = $1 AND kind = '${kind}'`,
  scope: `kind = '${kind}'`,
  beforeDelete: (id) => inUse(`SELECT COUNT(*) AS n FROM medicines WHERE ${kind === 'uom' ? 'uom_id' : 'category_id'} = $1`, id,
    `This ${label.toLowerCase()} is assigned to medicines and cannot be deleted`),
});
const categories = lookup('category', 'categories', 'Category');
const uoms = lookup('uom', 'uoms', 'UOM');

const EMP_SELECT = `SELECT e.*, b.name AS branch_name FROM employees e LEFT JOIN branches b ON b.id = e.branch_id`;
const employees = makeCrud({
  table: 'employees', pageKey: 'employees', label: 'Employee',
  fields: ['name', 'phone', 'cnic', 'job_role', 'branch_id', 'shift', 'joined_on', 'status'], required: ['name', 'phone'],
  codePrefix: 'EMP-', codeWidth: 3,
  listSql: () => `${EMP_SELECT} ORDER BY e.id DESC`,
  getSql: `${EMP_SELECT} WHERE e.id = $1`,
});

const PARTY_FIELDS = ['name', 'father_name', 'contact_person', 'phone', 'email', 'cnic', 'ntn', 'license_no',
  'payment_terms', 'gender', 'age', 'allergies', 'address', 'city', 'credit_allowed', 'credit_limit', 'status', 'party_type'];

const suppliers = makeCrud({
  table: 'parties', pageKey: 'suppliers', label: 'Supplier',
  fields: PARTY_FIELDS, required: ['name', 'phone'], codePrefix: 'SUP-', codeWidth: 4,
  transform: (b) => ({ ...b, party_type: 'supplier' }),
  listSql: () => `
    SELECT p.*,
      (SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'grn') AS total_purchases,
      (SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'purchase_return') AS total_returns,
      (SELECT COUNT(*) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'purchase_order')::int AS po_count,
      (SELECT MAX(t.txn_date) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'grn') AS last_supply
    FROM parties p WHERE p.party_type = 'supplier' ORDER BY p.id DESC`,
  getSql: `SELECT * FROM parties WHERE id = $1 AND party_type = 'supplier'`,
  scope: `party_type = 'supplier'`,
  beforeDelete: (id) => inUse(`SELECT COUNT(*) AS n FROM transactions WHERE party_id = $1`, id,
    'This supplier has purchase records and cannot be deleted. Set status to "On Hold" or "Blacklisted" instead.'),
});

const patients = makeCrud({
  table: 'parties', pageKey: 'patients', label: 'Patient',
  fields: PARTY_FIELDS, required: ['name', 'phone'], codePrefix: 'PT-', codeWidth: 4,
  transform: (b) => ({ ...b, party_type: 'customer', age: b.age === '' ? null : b.age }),
  listSql: (params, q) => `
    SELECT p.*,
      (SELECT COUNT(*) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'sale')::int AS total_visits,
      (SELECT MAX(t.txn_date) FROM transactions t WHERE t.party_id = p.id AND t.txn_type = 'sale') AS last_visit
    FROM parties p WHERE p.party_type = 'customer' ${dateRange(params, 'p.created_at', q)}
    ORDER BY p.id DESC`,
  getSql: `SELECT * FROM parties WHERE id = $1 AND party_type = 'customer'`,
  scope: `party_type = 'customer'`,
  beforeDelete: async (id) => {
    const p = (await db.query('SELECT balance FROM parties WHERE id = $1', [id])).rows[0];
    if (p && Number(p.balance) !== 0) throw httpError(400, 'This patient has an outstanding credit balance and cannot be deleted');
  },
});

const FIN_SELECT = `SELECT f.*, b.name AS branch_name, t.doc_no AS source_doc, COALESCE(u.full_name, u.username) AS created_by
  FROM finance_entries f LEFT JOIN branches b ON b.id = f.branch_id
  LEFT JOIN transactions t ON t.id = f.source_txn_id LEFT JOIN users u ON u.id = f.user_id`;
const finance = makeCrud({
  table: 'finance_entries', pageKey: 'finance', label: 'Finance entry',
  fields: ['entry_date', 'entry_type', 'category', 'method', 'amount', 'note', 'branch_id'],
  required: ['entry_type', 'amount'], userField: 'user_id',
  codePrefix: () => `TXN-${new Date().getFullYear()}-`, codeCol: 'ref', codeWidth: 4,
  listSql: (params, q) => {
    let w = 'WHERE 1=1' + dateRange(params, 'f.entry_date', q);
    if (q.type && q.type !== 'All Types') { params.push(q.type); w += ` AND f.entry_type = $${params.length}`; }
    return `${FIN_SELECT} ${w} ORDER BY f.entry_date DESC, f.id DESC`;
  },
  getSql: `${FIN_SELECT} WHERE f.id = $1`,
  beforeUpdate: async (id) => {
    const f = (await db.query('SELECT source_txn_id FROM finance_entries WHERE id = $1', [id])).rows[0];
    if (f && f.source_txn_id) throw httpError(400, 'This entry was created by a credit payment. Change it from the Credit page instead.');
  },
  beforeDelete: async (id) => {
    const f = (await db.query('SELECT source_txn_id FROM finance_entries WHERE id = $1', [id])).rows[0];
    if (f && f.source_txn_id) throw httpError(400, 'This entry was created by a credit payment. Delete the payment from the Credit page instead.');
  },
});

module.exports = { branches, cities, categories, uoms, employees, suppliers, patients, finance };
