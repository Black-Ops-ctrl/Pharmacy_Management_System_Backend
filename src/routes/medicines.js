const db = require('../config/db');
const makeCrud = require('../utils/crud');
const { authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError, withTx } = require('../utils/helpers');

const STATUSES = ['Active', 'Inactive'];
const posInt = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const cleanBarcode = (v) => { const s = text(v).replace(/\s+/g, ''); return s || null; };

const barcodeOwner = async (code, excludeId, q = db) => {
  if (!code) return null;
  const { rows } = await q.query(
    'SELECT id, code, name FROM medicines WHERE barcode = $1 AND ($2::int IS NULL OR id <> $2) LIMIT 1',
    [code, excludeId || null]);
  return rows[0] || null;
};

const usedMessage = (code, m) => `Barcode ${code} is already used by ${m.name} (${m.code})`;

const lookupExists = async (id, kind) =>
  (await db.query('SELECT 1 FROM lookups WHERE id = $1 AND kind = $2', [id, kind])).rowCount > 0;

const IMPORT_COLUMNS = {
  name: 'Medicine Name', generic: 'Generic Name', category: 'Category', uom: 'UOM',
  box_size: 'Box Contains (Strips)', pack_size: 'Strip Contains (Units)',
  price: 'Unit Price', discount: 'Discount (%)', barcode: 'Barcode', status: 'Status',
};

module.exports = makeCrud({
  table: 'medicines', pageKey: 'medicines', label: 'Medicine',
  fields: ['name', 'generic', 'category_id', 'uom_id', 'pack_type', 'box_size', 'pack_size', 'barcode', 'price', 'discount', 'status'],
  required: ['name', 'category_id', 'uom_id'],
  codePrefix: 'MED-', codeWidth: 4,
  transform: (b) => {
    const out = { ...b };
    if (out.name !== undefined) out.name = text(out.name);
    if (out.generic !== undefined) out.generic = text(out.generic) || null;
    if (b.box_size !== undefined || b.pack_size !== undefined) {
      const box = posInt(b.box_size) || 1;
      const pack = posInt(b.pack_size) || 1;
      out.box_size = box; out.pack_size = pack; out.pack_type = `${box} x ${pack}`;
    }
    if (out.barcode !== undefined) out.barcode = cleanBarcode(out.barcode);
    ['price', 'discount'].forEach((k) => { if (out[k] === '' || out[k] === null) out[k] = 0; });
    return out;
  },
  validate: async (b, id) => {
    if (b.name !== undefined && !b.name) throw httpError(400, 'Medicine name is required');
    if (b.price !== undefined && !(Number(b.price) >= 0)) throw httpError(400, 'Unit price must be 0 or more');
    if (b.discount !== undefined && !(Number(b.discount) >= 0 && Number(b.discount) <= 100)) throw httpError(400, 'Discount must be between 0 and 100');
    if (b.status !== undefined && !STATUSES.includes(b.status)) throw httpError(400, 'Status must be Active or Inactive');
    if (b.category_id !== undefined && !(await lookupExists(b.category_id, 'category'))) throw httpError(400, 'Select a valid category');
    if (b.uom_id !== undefined && !(await lookupExists(b.uom_id, 'uom'))) throw httpError(400, 'Select a valid UOM');
    const owner = await barcodeOwner(b.barcode, id);
    if (owner) throw httpError(409, usedMessage(b.barcode, owner));
  },
  extend: (r) => {
    r.get('/barcode-check', authorize('medicines', 'view'), asyncHandler(async (req, res) => {
      const code = cleanBarcode(req.query.code);
      const owner = await barcodeOwner(code, Number(req.query.exclude_id) || null);
      ok(res, owner ? { used: true, medicine: owner, message: usedMessage(code, owner) } : { used: false });
    }));

    r.post('/import', authorize('medicines', 'create'), asyncHandler(async (req, res) => {
      const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
      if (!rows.length) throw httpError(400, 'The file has no medicine rows');
      if (rows.length > 5000) throw httpError(400, 'Import up to 5000 medicines at a time');
      const lk = (await db.query('SELECT id, kind, lower(name) AS n FROM lookups')).rows;
      const cats = new Map(lk.filter((x) => x.kind === 'category').map((x) => [x.n, x.id]));
      const uoms = new Map(lk.filter((x) => x.kind === 'uom').map((x) => [x.n, x.id]));
      const names = new Set((await db.query('SELECT lower(name) AS n FROM medicines')).rows.map((x) => x.n));
      const codes = new Map((await db.query('SELECT barcode, code, name FROM medicines WHERE barcode IS NOT NULL')).rows.map((x) => [x.barcode, x]));
      const seenNames = new Map();
      const seenCodes = new Map();
      const errors = [];
      const clean = [];
      const err = (row, col, message) => errors.push({ row, column: IMPORT_COLUMNS[col] || col, message });

      rows.forEach((r, i) => {
        const row = Number(r.row) || i + 2;
        const name = text(r.name);
        const cat = text(r.category);
        const uom = text(r.uom);
        const barcode = cleanBarcode(r.barcode);
        const status = text(r.status) || 'Active';
        const box = text(r.box_size) === '' ? 1 : posInt(r.box_size);
        const pack = text(r.pack_size) === '' ? 1 : posInt(r.pack_size);
        const price = text(r.price) === '' ? 0 : Number(r.price);
        const discount = text(r.discount) === '' ? 0 : Number(r.discount);
        if (!name) err(row, 'name', 'Medicine name is required');
        else if (names.has(name.toLowerCase())) err(row, 'name', `${name} already exists`);
        else if (seenNames.has(name.toLowerCase())) err(row, 'name', `${name} is repeated (row ${seenNames.get(name.toLowerCase())})`);
        if (!cat) err(row, 'category', 'Category is required');
        else if (!cats.has(cat.toLowerCase())) err(row, 'category', `Category "${cat}" not found`);
        if (!uom) err(row, 'uom', 'UOM is required');
        else if (!uoms.has(uom.toLowerCase())) err(row, 'uom', `UOM "${uom}" not found`);
        if (!box) err(row, 'box_size', 'Enter a whole number greater than 0');
        if (!pack) err(row, 'pack_size', 'Enter a whole number greater than 0');
        if (!Number.isFinite(price) || price < 0) err(row, 'price', 'Enter a price of 0 or more');
        if (!Number.isFinite(discount) || discount < 0 || discount > 100) err(row, 'discount', 'Enter a discount between 0 and 100');
        const st = STATUSES.find((s) => s.toLowerCase() === status.toLowerCase());
        if (!st) err(row, 'status', 'Status must be Active or Inactive');
        if (barcode) {
          if (codes.has(barcode)) err(row, 'barcode', usedMessage(barcode, codes.get(barcode)));
          else if (seenCodes.has(barcode)) err(row, 'barcode', `Barcode ${barcode} is repeated (row ${seenCodes.get(barcode)})`);
          seenCodes.set(barcode, seenCodes.get(barcode) || row);
        }
        if (name) seenNames.set(name.toLowerCase(), seenNames.get(name.toLowerCase()) || row);
        clean.push({
          name, generic: text(r.generic) || null, category_id: cats.get(cat.toLowerCase()), uom_id: uoms.get(uom.toLowerCase()),
          box_size: box, pack_size: pack, pack_type: `${box} x ${pack}`, price, discount, barcode, status: st,
        });
      });

      if (errors.length) {
        return res.status(400).json({ success: false, error: `${errors.length} problem${errors.length === 1 ? '' : 's'} found. Nothing was imported.`, errors });
      }

      const count = await withTx(async (client) => {
        for (const m of clean) {
          await client.query(
            `INSERT INTO medicines (code, name, generic, category_id, uom_id, box_size, pack_size, pack_type, price, discount, barcode, status)
             VALUES (fn_next_code('medicines','code','MED-',4),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [m.name, m.generic, m.category_id, m.uom_id, m.box_size, m.pack_size, m.pack_type, m.price, m.discount, m.barcode, m.status]);
        }
        return clean.length;
      });
      ok(res, { imported: count }, `${count} medicine${count === 1 ? '' : 's'} imported`, 201);
    }));
  },
  listSql: () => 'SELECT * FROM v_medicines ORDER BY id DESC',
  getSql: 'SELECT * FROM v_medicines WHERE id = $1',
  beforeDelete: async (id) => {
    const n = (await db.query(
      `SELECT (SELECT COUNT(*) FROM batches WHERE medicine_id = $1) + (SELECT COUNT(*) FROM transaction_items WHERE medicine_id = $1) AS n`,
      [id])).rows[0].n;
    if (Number(n) > 0) throw httpError(400, 'This medicine has stock or transaction history and cannot be deleted. Set its status to "Inactive" instead.');
  },
});
