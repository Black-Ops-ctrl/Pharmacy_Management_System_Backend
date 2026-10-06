const PAGES = {
  'dashboard':        [],
  'pos':              ['create', 'print'],
  'sale-invoices':    ['delete', 'print'],
  'sale-returns':     ['create', 'delete', 'print'],
  'medicines':        ['create', 'edit', 'delete', 'print'],
  'categories':       ['create', 'edit', 'delete'],
  'uoms':             ['create', 'edit', 'delete'],
  'inv-stock':        ['delete', 'print'],
  'inv-batches':      ['edit', 'delete', 'print'],
  'inv-adjustments':  ['create', 'edit', 'delete', 'print'],
  'inv-expiry':       ['edit', 'delete', 'print'],
  'purchase-orders':  ['create', 'edit', 'delete', 'print'],
  'grn':              ['create', 'edit', 'delete', 'print'],
  'purchase-returns': ['create', 'edit', 'delete', 'print'],
  'suppliers':        ['create', 'edit', 'delete'],
  'patients':         ['create', 'edit', 'delete', 'print'],
  'prescriptions':    ['create', 'edit', 'delete', 'print'],
  'credit':           ['create', 'edit', 'delete', 'print'],
  'finance':          ['create', 'edit', 'delete', 'print'],
  'branches':         ['create', 'edit', 'delete'],
  'cities':           ['create', 'edit', 'delete'],
  'employees':        ['create', 'edit', 'delete'],
  'reports':          ['print'],
  'online-orders':    ['edit', 'delete', 'print'],
  'company-profile':  ['edit'],
  'admin':            ['create', 'edit', 'delete'],
  'database-backup':  ['create', 'edit', 'delete'],
};

const build = (pick) => {
  const out = {};
  Object.entries(PAGES).forEach(([key, actions]) => {
    const row = { view: false, create: false, edit: false, delete: false, print: false };
    ['view', ...actions].forEach((a) => { row[a] = !!pick(key, a); });
    out[key] = row;
  });
  return out;
};

const inSet = (keys, actions) => (k, a) => keys.includes(k) && (!actions || actions.includes(a));

const DEFAULT_ROLES = {
  'Super Admin': build(() => true),
  'Branch Manager': build((k) => k !== 'admin' && k !== 'company-profile' && k !== 'database-backup'),
  'Pharmacist': build(inSet(['dashboard', 'pos', 'sale-invoices', 'sale-returns', 'medicines', 'categories', 'uoms',
    'inv-stock', 'inv-batches', 'inv-expiry', 'patients', 'prescriptions', 'credit', 'reports'],
    ['view', 'create', 'edit', 'print'])),
  'Cashier': build(inSet(['dashboard', 'pos', 'sale-invoices', 'sale-returns', 'medicines', 'patients', 'prescriptions', 'online-orders'],
    ['view', 'create', 'print'])),
};

module.exports = { PAGES, DEFAULT_ROLES, build };
