const TABLES = {
  cities: 'City', branches: 'Branch', parties: 'Record', lookups: 'Record', medicines: 'Medicine', users: 'Username',
  roles: 'Role', employees: 'Employee', transactions: 'Document', online_orders: 'Order', finance_entries: 'Entry',
};

const errorHandler = (err, req, res, next) => {
  if (!err.status || err.status >= 500) console.error('Error:', err.message);

  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: 'Invalid request data' });
  if (err.type === 'entity.too.large') return res.status(413).json({ success: false, error: 'The data sent is too large' });
  if (err.code === '23505') {
    const d = err.detail || '';
    const m = d.match(/Key \((.+?)\)=\((.+?)\)/);
    if (m && /barcode/.test(m[1])) return res.status(409).json({ success: false, error: `Barcode ${m[2]} is already used by another medicine` });
    if (!m) return res.status(409).json({ success: false, error: 'This record already exists' });
    const cols = m[1].replace(/lower\((.+?)\)/g, '$1').split(/,\s*/);
    const vals = m[2].split(/,\s*/);
    const value = vals[vals.length - 1];
    let what = TABLES[err.table] || '';
    if (cols[0] === 'kind' && vals.length > 1) what = vals[0] === 'uom' ? 'Unit of measure' : vals[0].charAt(0).toUpperCase() + vals[0].slice(1);
    const field = cols[cols.length - 1].replace(/_/g, ' ');
    const label = what ? (['name', 'username'].includes(field) || cols[0] === 'kind' ? what : `${what} ${field}`) : field.charAt(0).toUpperCase() + field.slice(1);
    return res.status(409).json({ success: false, error: `${label} "${value}" already exists` });
  }
  if (err.code === '23503') return res.status(400).json({ success: false, error: 'This record is linked to other records and cannot be changed or deleted' });
  if (err.code === '23514') return res.status(400).json({ success: false, error: 'Value not allowed (quantity cannot go below zero)' });
  if (err.code === '23502') return res.status(400).json({ success: false, error: 'A required value is missing' });
  if (err.code === '22001') return res.status(400).json({ success: false, error: 'A value is too long' });
  if (err.code === '22003') return res.status(400).json({ success: false, error: 'A number is too large' });
  if (err.code === '22P02' || err.code === '22007' || err.code === '22008') return res.status(400).json({ success: false, error: 'Invalid value format' });
  if (err.code === '42P01' || err.code === '42703') return res.status(500).json({ success: false, error: 'Database is not up to date. Run database/schema.sql' });
  if (err.code === 'P0001') return res.status(400).json({ success: false, error: err.message });

  res.status(err.status || 500).json({ success: false, error: err.status && err.status < 500 ? err.message : 'Something went wrong on the server. Please try again.' });
};

module.exports = errorHandler;
