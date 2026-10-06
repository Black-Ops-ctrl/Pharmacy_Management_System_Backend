const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError } = require('../utils/helpers');

const TEXT = {
  name: 120,
  phone: 40,
  address: 500,
  ntn: 40,
  email: 120,
  website: 120,
  top_bar_text: 160,
  print_footer_note: 300,
  logo_name: 200,
  receipt_header: 160,
  receipt_thanks: 200,
  receipt_policy: 300,
};
const REQUIRED = { name: 'Pharmacy name', phone: 'Phone', address: 'Head office address' };
const LOGO_MAX = 10 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*;base64,[a-z0-9+/=\s]+$/i;

const clean = (v) => (v === undefined || v === null ? null : String(v).trim() || null);

const read = async () => {
  const r = await db.query('SELECT * FROM company_profile WHERE id = 1');
  return r.rows[0] || null;
};

router.get('/', asyncHandler(async (req, res) => ok(res, (await read()) || {})));

router.put('/', authenticate, authorize('company-profile', 'edit'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const row = {};
  for (const [k, max] of Object.entries(TEXT)) {
    const v = clean(b[k]);
    if (v && v.length > max) throw httpError(400, `${k.replace(/_/g, ' ')} is too long (max ${max} characters)`);
    row[k] = v;
  }
  for (const [k, label] of Object.entries(REQUIRED)) if (!row[k]) throw httpError(400, `${label} is required`);
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw httpError(400, 'Enter a valid email');

  let logo = b.logo === undefined ? undefined : clean(b.logo);
  if (logo) {
    if (!IMAGE_DATA_URL.test(logo)) throw httpError(400, 'Logo must be an image file');
    if (logo.length > LOGO_MAX) throw httpError(400, 'Logo image is too large');
  }
  if (logo === null) row.logo_name = null;

  const cols = Object.keys(TEXT).filter((k) => k !== 'logo_name' || logo !== undefined);
  const vals = cols.map((k) => row[k]);
  if (logo !== undefined) { cols.push('logo'); vals.push(logo); }
  if (b.receipt_width !== undefined) {
    const w = Number(b.receipt_width);
    if (![58, 80].includes(w)) throw httpError(400, 'Receipt paper width must be 58 or 80 mm');
    cols.push('receipt_width'); vals.push(w);
  }
  if (b.receipt_copies !== undefined) {
    const c = Number(b.receipt_copies);
    if (!Number.isInteger(c) || c < 1 || c > 3) throw httpError(400, 'Number of copies must be 1, 2 or 3');
    cols.push('receipt_copies'); vals.push(c);
  }
  for (const k of ['receipt_show_logo', 'receipt_show_barcode']) {
    if (b[k] !== undefined) { cols.push(k); vals.push(!!b[k]); }
  }
  if (b.max_discount_pct !== undefined) {
    const d = Number(b.max_discount_pct);
    if (b.max_discount_pct === '' || !Number.isFinite(d) || d < 0 || d > 100) throw httpError(400, 'Maximum discount must be between 0 and 100');
    cols.push('max_discount_pct'); vals.push(d);
  }
  cols.push('updated_by'); vals.push(req.user.name || req.user.username);

  const set = cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  await db.query(
    `INSERT INTO company_profile (id, ${cols.join(', ')}, updated_at)
     VALUES (1, ${cols.map((_, i) => `$${i + 1}`).join(', ')}, now())
     ON CONFLICT (id) DO UPDATE SET ${set}, updated_at = now()`,
    vals
  );
  ok(res, await read(), 'Pharmacy settings saved');
}));

module.exports = router;
