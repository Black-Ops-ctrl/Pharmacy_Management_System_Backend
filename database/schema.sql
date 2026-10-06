CREATE TABLE IF NOT EXISTS company_profile (
  id                 INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name               VARCHAR(120),
  phone              VARCHAR(40),
  address            TEXT,
  ntn                VARCHAR(40),
  email              VARCHAR(120),
  website            VARCHAR(120),
  top_bar_text       VARCHAR(160),
  print_footer_note  VARCHAR(300),
  logo               TEXT,
  logo_name          VARCHAR(200),
  updated_by         VARCHAR(100),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS receipt_width        INT          DEFAULT 80;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS receipt_show_logo    BOOLEAN      DEFAULT TRUE;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS receipt_show_barcode BOOLEAN      DEFAULT TRUE;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS receipt_copies       INT          DEFAULT 1;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS receipt_header       VARCHAR(160);
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS receipt_thanks       VARCHAR(200);
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS receipt_policy       VARCHAR(300);
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS max_discount_pct     NUMERIC(5,2) DEFAULT 10;

CREATE TABLE IF NOT EXISTS roles (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(60) UNIQUE NOT NULL,
  permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50) UNIQUE NOT NULL,
  password    VARCHAR(200) NOT NULL,
  full_name   VARCHAR(100),
  role_id     INT REFERENCES roles(id) ON DELETE SET NULL,
  status      VARCHAR(15) DEFAULT 'Active',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token       VARCHAR(80) PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  last_seen   TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE,
  name        VARCHAR(100) NOT NULL,
  city        VARCHAR(60),
  address     TEXT,
  phone       VARCHAR(30),
  manager     VARCHAR(100),
  status      VARCHAR(20) DEFAULT 'Active',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cities (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(60) UNIQUE NOT NULL,
  status      VARCHAR(15) DEFAULT 'Active',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parties (
  id              SERIAL PRIMARY KEY,
  party_type      VARCHAR(15) NOT NULL CHECK (party_type IN ('supplier','customer')),
  code            VARCHAR(20) UNIQUE,
  name            VARCHAR(120) NOT NULL,
  father_name     VARCHAR(120),
  contact_person  VARCHAR(120),
  phone           VARCHAR(30),
  email           VARCHAR(120),
  cnic            VARCHAR(20),
  ntn             VARCHAR(30),
  license_no      VARCHAR(60),
  payment_terms   VARCHAR(40),
  gender          VARCHAR(10),
  age             INT,
  allergies       TEXT,
  address         TEXT,
  city            VARCHAR(60),
  credit_allowed  BOOLEAN DEFAULT FALSE,
  credit_limit    NUMERIC(12,2) DEFAULT 0,
  balance         NUMERIC(12,2) DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'Active',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookups (
  id      SERIAL PRIMARY KEY,
  kind    VARCHAR(20) NOT NULL CHECK (kind IN ('category','uom')),
  name    VARCHAR(80) NOT NULL,
  symbol  VARCHAR(20),
  UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS medicines (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(40) UNIQUE,
  name           VARCHAR(150) NOT NULL,
  generic        VARCHAR(150),
  category_id    INT REFERENCES lookups(id) ON DELETE SET NULL,
  uom_id         INT REFERENCES lookups(id) ON DELETE SET NULL,
  pack_type      VARCHAR(40),
  box_size       INT DEFAULT 1,
  pack_size      INT DEFAULT 1,
  barcode        VARCHAR(60),
  price          NUMERIC(12,2) DEFAULT 0,
  discount       NUMERIC(5,2)  DEFAULT 0,
  status         VARCHAR(15)   DEFAULT 'Active',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id              SERIAL PRIMARY KEY,
  doc_no          VARCHAR(40) UNIQUE NOT NULL,
  txn_type        VARCHAR(20) NOT NULL CHECK (txn_type IN
                  ('sale','sale_return','purchase_order','grn','purchase_return','adjustment','prescription','credit_payment')),
  txn_date        TIMESTAMPTZ DEFAULT now(),
  party_id        INT REFERENCES parties(id) ON DELETE SET NULL,
  branch_id       INT REFERENCES branches(id) ON DELETE SET NULL,
  user_id         INT REFERENCES users(id) ON DELETE SET NULL,
  ref_txn_id      INT REFERENCES transactions(id) ON DELETE SET NULL,
  status          VARCHAR(25) DEFAULT 'Completed',
  payment_method  VARCHAR(30),
  subtotal        NUMERIC(12,2) DEFAULT 0,
  discount        NUMERIC(12,2) DEFAULT 0,
  tax             NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  meta            JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batches (
  id             SERIAL PRIMARY KEY,
  medicine_id    INT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  branch_id      INT REFERENCES branches(id) ON DELETE SET NULL,
  supplier_id    INT REFERENCES parties(id) ON DELETE SET NULL,
  grn_txn_id     INT REFERENCES transactions(id) ON DELETE SET NULL,
  batch_no       VARCHAR(60) NOT NULL,
  expiry         DATE,
  received_date  DATE DEFAULT CURRENT_DATE,
  received_qty   NUMERIC(12,2) DEFAULT 0,
  qty            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  unit_cost      NUMERIC(12,4) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id           SERIAL PRIMARY KEY,
  txn_id       INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  medicine_id  INT REFERENCES medicines(id) ON DELETE SET NULL,
  batch_id     INT REFERENCES batches(id) ON DELETE SET NULL,
  description  VARCHAR(200),
  qty          NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_price   NUMERIC(12,4) DEFAULT 0,
  amount       NUMERIC(12,2) DEFAULT 0,
  meta         JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS employees (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(30),
  cnic        VARCHAR(20),
  job_role    VARCHAR(60),
  branch_id   INT REFERENCES branches(id) ON DELETE SET NULL,
  shift       VARCHAR(40),
  joined_on   DATE DEFAULT CURRENT_DATE,
  status      VARCHAR(20) DEFAULT 'Active',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_entries (
  id            SERIAL PRIMARY KEY,
  ref           VARCHAR(30) UNIQUE NOT NULL,
  entry_date    DATE DEFAULT CURRENT_DATE,
  entry_type    VARCHAR(10) NOT NULL CHECK (entry_type IN ('Income','Expense')),
  category      VARCHAR(60),
  method        VARCHAR(30),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note          TEXT,
  branch_id     INT REFERENCES branches(id) ON DELETE SET NULL,
  source_txn_id INT REFERENCES transactions(id) ON DELETE CASCADE,
  user_id       INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS online_orders (
  id            SERIAL PRIMARY KEY,
  order_no      VARCHAR(30) UNIQUE NOT NULL,
  sale_txn_id   INT REFERENCES transactions(id) ON DELETE CASCADE,
  order_date    TIMESTAMPTZ DEFAULT now(),
  customer_name VARCHAR(120),
  phone         VARCHAR(30),
  address       TEXT,
  payment       VARCHAR(40),
  rider         VARCHAR(100),
  status        VARCHAR(25) DEFAULT 'New',
  total         NUMERIC(12,2) DEFAULT 0,
  branch_id     INT REFERENCES branches(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backup_settings (
  id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled         BOOLEAN DEFAULT TRUE,
  every_days      INT DEFAULT 1 CHECK (every_days BETWEEN 1 AND 365),
  run_time        VARCHAR(5) DEFAULT '23:00',
  keep_count      INT DEFAULT 30 CHECK (keep_count >= 0),
  folder          VARCHAR(400),
  last_auto_at    TIMESTAMPTZ,
  last_backup_at  TIMESTAMPTZ,
  last_status     VARCHAR(20),
  last_message    TEXT,
  updated_by      VARCHAR(100),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
INSERT INTO backup_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP VIEW IF EXISTS v_medicines;
DROP VIEW IF EXISTS v_medicine_stock;
ALTER TABLE medicines DROP COLUMN IF EXISTS reorder_level;

UPDATE medicines SET barcode = NULLIF(btrim(barcode), '') WHERE barcode IS DISTINCT FROM NULLIF(btrim(barcode), '');

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties (party_type);
CREATE INDEX IF NOT EXISTS idx_parties_type_status ON parties (party_type, status);
CREATE INDEX IF NOT EXISTS idx_parties_city ON parties (city);
CREATE INDEX IF NOT EXISTS idx_branches_city ON branches (city);
CREATE INDEX IF NOT EXISTS idx_lookups_kind_name ON lookups (kind, name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines (category_id);
CREATE INDEX IF NOT EXISTS idx_medicines_uom ON medicines (uom_id);
CREATE INDEX IF NOT EXISTS idx_medicines_status_name ON medicines (status, name);
CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medicines_lower_name ON medicines (lower(name));
CREATE INDEX IF NOT EXISTS idx_txn_type_date ON transactions (txn_type, txn_date);
CREATE INDEX IF NOT EXISTS idx_txn_party ON transactions (party_id);
CREATE INDEX IF NOT EXISTS idx_txn_party_type ON transactions (party_id, txn_type);
CREATE INDEX IF NOT EXISTS idx_txn_branch ON transactions (branch_id);
CREATE INDEX IF NOT EXISTS idx_txn_ref ON transactions (ref_txn_id);
CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_batches_med_expiry ON batches (medicine_id, expiry);
CREATE INDEX IF NOT EXISTS idx_batches_branch ON batches (branch_id);
CREATE INDEX IF NOT EXISTS idx_batches_supplier ON batches (supplier_id);
CREATE INDEX IF NOT EXISTS idx_batches_grn ON batches (grn_txn_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry_live ON batches (expiry) WHERE qty > 0;
CREATE INDEX IF NOT EXISTS idx_batches_received ON batches (received_date);
CREATE INDEX IF NOT EXISTS idx_txn_items_txn ON transaction_items (txn_id);
CREATE INDEX IF NOT EXISTS idx_txn_items_batch ON transaction_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_txn_items_medicine ON transaction_items (medicine_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees (branch_id);
CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_finance_source ON finance_entries (source_txn_id);
CREATE INDEX IF NOT EXISTS idx_finance_branch ON finance_entries (branch_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_sale ON online_orders (sale_txn_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_date ON online_orders (order_date);
CREATE INDEX IF NOT EXISTS idx_online_orders_branch ON online_orders (branch_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_medicines_barcode')
     AND NOT EXISTS (SELECT barcode FROM medicines WHERE barcode IS NOT NULL GROUP BY barcode HAVING COUNT(*) > 1) THEN
    CREATE UNIQUE INDEX uq_medicines_barcode ON medicines (barcode) WHERE barcode IS NOT NULL;
  END IF;
END $$;

CREATE VIEW v_medicine_stock AS
SELECT m.id AS medicine_id,
       COALESCE(SUM(b.qty) FILTER (WHERE b.expiry IS NULL OR b.expiry >= CURRENT_DATE), 0) AS stock
FROM medicines m
LEFT JOIN batches b ON b.medicine_id = m.id
GROUP BY m.id;

CREATE VIEW v_medicines AS
SELECT m.*,
       c.name AS category_name,
       u.name AS uom_name,
       ROUND(m.price - (m.price * COALESCE(m.discount,0) / 100.0), 2) AS sale_price,
       COALESCE(s.stock, 0) AS stock
FROM medicines m
LEFT JOIN lookups c ON c.id = m.category_id
LEFT JOIN lookups u ON u.id = m.uom_id
LEFT JOIN v_medicine_stock s ON s.medicine_id = m.id;

CREATE OR REPLACE FUNCTION fn_next_doc_no(p_type text) RETURNS text AS $$
DECLARE pfx text; n int; yr text := to_char(now(),'YYYY');
BEGIN
  pfx := CASE p_type
           WHEN 'sale' THEN 'INV'            WHEN 'sale_return' THEN 'SR'
           WHEN 'purchase_order' THEN 'PO'   WHEN 'grn' THEN 'GRN'
           WHEN 'purchase_return' THEN 'PR'  WHEN 'adjustment' THEN 'ADJ'
           WHEN 'prescription' THEN 'RX'     WHEN 'credit_payment' THEN 'RCPT'
           ELSE 'DOC' END;
  PERFORM pg_advisory_xact_lock(hashtext('doc_no_' || p_type));
  SELECT COALESCE(MAX(NULLIF(regexp_replace(doc_no, '^.*-', ''), '')::int), 0) + 1 INTO n
  FROM transactions
  WHERE doc_no LIKE pfx || '-' || yr || '-%';
  RETURN pfx || '-' || yr || '-' || lpad(n::text, 4, '0');
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_next_code(p_table text, p_col text, p_prefix text, p_width int)
RETURNS text AS $$
DECLARE n int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('code_' || p_table || p_prefix));
  EXECUTE format(
    'SELECT COALESCE(MAX(NULLIF(regexp_replace(%I, ''^%s'', ''''), '''')::int), 0) + 1 FROM %I WHERE %I LIKE %L',
    p_col, p_prefix, p_table, p_col, p_prefix || '%')
  INTO n;
  RETURN p_prefix || lpad(n::text, p_width, '0');
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_get_transaction(p_id int) RETURNS jsonb AS $$
DECLARE res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', t.id, 'doc_no', t.doc_no, 'txn_type', t.txn_type, 'txn_date', t.txn_date,
    'status', t.status, 'payment_method', t.payment_method,
    'subtotal', t.subtotal, 'discount', t.discount, 'tax', t.tax, 'total', t.total,
    'party_id', t.party_id, 'party_name', p.name, 'party_phone', p.phone, 'party_code', p.code,
    'branch_id', t.branch_id, 'branch_name', br.name,
    'user_id', t.user_id, 'user_name', COALESCE(u.full_name, u.username),
    'ref_txn_id', t.ref_txn_id, 'ref_doc_no', rt.doc_no,
    'notes', t.notes, 'meta', t.meta,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ti.id, 'medicine_id', ti.medicine_id, 'medicine', m.name, 'uom', uo.name,
        'batch_id', ti.batch_id, 'batch_no', COALESCE(b.batch_no, ti.meta->>'batch_no'),
        'expiry', COALESCE(b.expiry::text, ti.meta->>'expiry'),
        'qty', ti.qty, 'unit_price', ti.unit_price, 'amount', ti.amount,
        'description', ti.description, 'meta', ti.meta
      ) ORDER BY ti.id)
      FROM transaction_items ti
      LEFT JOIN medicines m ON m.id = ti.medicine_id
      LEFT JOIN lookups uo ON uo.id = m.uom_id
      LEFT JOIN batches   b ON b.id = ti.batch_id
      WHERE ti.txn_id = t.id), '[]'::jsonb)
  ) INTO res
  FROM transactions t
  LEFT JOIN parties  p  ON p.id  = t.party_id
  LEFT JOIN branches br ON br.id = t.branch_id
  LEFT JOIN users    u  ON u.id  = t.user_id
  LEFT JOIN transactions rt ON rt.id = t.ref_txn_id
  WHERE t.id = p_id;
  RETURN res;
END; $$ LANGUAGE plpgsql;

INSERT INTO roles (name, permissions, is_system) VALUES
('Super Admin', '{"dashboard":{"view":true,"create":false,"edit":false,"delete":false,"print":false},"pos":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"sale-invoices":{"view":true,"create":false,"edit":false,"delete":true,"print":true},"sale-returns":{"view":true,"create":true,"edit":false,"delete":true,"print":true},"medicines":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"categories":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"uoms":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"inv-stock":{"view":true,"create":false,"edit":false,"delete":true,"print":true},"inv-batches":{"view":true,"create":false,"edit":true,"delete":true,"print":true},"inv-adjustments":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"inv-expiry":{"view":true,"create":false,"edit":true,"delete":true,"print":true},"purchase-orders":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"grn":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"purchase-returns":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"suppliers":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"patients":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"prescriptions":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"credit":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"finance":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"branches":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"cities":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"employees":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"reports":{"view":true,"create":false,"edit":false,"delete":false,"print":true},"online-orders":{"view":true,"create":false,"edit":true,"delete":true,"print":true},"company-profile":{"view":true,"create":false,"edit":true,"delete":false,"print":false},"admin":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"database-backup":{"view":true,"create":true,"edit":true,"delete":true,"print":false}}'::jsonb, TRUE),
('Branch Manager', '{"dashboard":{"view":true,"create":false,"edit":false,"delete":false,"print":false},"pos":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"sale-invoices":{"view":true,"create":false,"edit":false,"delete":true,"print":true},"sale-returns":{"view":true,"create":true,"edit":false,"delete":true,"print":true},"medicines":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"categories":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"uoms":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"inv-stock":{"view":true,"create":false,"edit":false,"delete":true,"print":true},"inv-batches":{"view":true,"create":false,"edit":true,"delete":true,"print":true},"inv-adjustments":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"inv-expiry":{"view":true,"create":false,"edit":true,"delete":true,"print":true},"purchase-orders":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"grn":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"purchase-returns":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"suppliers":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"patients":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"prescriptions":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"credit":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"finance":{"view":true,"create":true,"edit":true,"delete":true,"print":true},"branches":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"cities":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"employees":{"view":true,"create":true,"edit":true,"delete":true,"print":false},"reports":{"view":true,"create":false,"edit":false,"delete":false,"print":true},"online-orders":{"view":true,"create":false,"edit":true,"delete":true,"print":true},"company-profile":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"admin":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"database-backup":{"view":false,"create":false,"edit":false,"delete":false,"print":false}}'::jsonb, FALSE),
('Pharmacist', '{"dashboard":{"view":true,"create":false,"edit":false,"delete":false,"print":false},"pos":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"sale-invoices":{"view":true,"create":false,"edit":false,"delete":false,"print":true},"sale-returns":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"medicines":{"view":true,"create":true,"edit":true,"delete":false,"print":true},"categories":{"view":true,"create":true,"edit":true,"delete":false,"print":false},"uoms":{"view":true,"create":true,"edit":true,"delete":false,"print":false},"inv-stock":{"view":true,"create":false,"edit":false,"delete":false,"print":true},"inv-batches":{"view":true,"create":false,"edit":true,"delete":false,"print":true},"inv-adjustments":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"inv-expiry":{"view":true,"create":false,"edit":true,"delete":false,"print":true},"purchase-orders":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"grn":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"purchase-returns":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"suppliers":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"patients":{"view":true,"create":true,"edit":true,"delete":false,"print":true},"prescriptions":{"view":true,"create":true,"edit":true,"delete":false,"print":true},"credit":{"view":true,"create":true,"edit":true,"delete":false,"print":true},"finance":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"branches":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"cities":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"employees":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"reports":{"view":true,"create":false,"edit":false,"delete":false,"print":true},"online-orders":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"company-profile":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"admin":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"database-backup":{"view":false,"create":false,"edit":false,"delete":false,"print":false}}'::jsonb, FALSE),
('Cashier', '{"dashboard":{"view":true,"create":false,"edit":false,"delete":false,"print":false},"pos":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"sale-invoices":{"view":true,"create":false,"edit":false,"delete":false,"print":true},"sale-returns":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"medicines":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"categories":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"uoms":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"inv-stock":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"inv-batches":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"inv-adjustments":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"inv-expiry":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"purchase-orders":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"grn":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"purchase-returns":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"suppliers":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"patients":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"prescriptions":{"view":true,"create":true,"edit":false,"delete":false,"print":true},"credit":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"finance":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"branches":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"cities":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"employees":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"reports":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"online-orders":{"view":true,"create":false,"edit":false,"delete":false,"print":true},"company-profile":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"admin":{"view":false,"create":false,"edit":false,"delete":false,"print":false},"database-backup":{"view":false,"create":false,"edit":false,"delete":false,"print":false}}'::jsonb, FALSE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (username, password, full_name, role_id, status)
VALUES ('admin', 'admin@123', 'Administrator', (SELECT id FROM roles WHERE name = 'Super Admin'), 'Active')
ON CONFLICT (username) DO NOTHING;

UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Super Admin')
WHERE username = 'admin' AND role_id IS NULL;

UPDATE users SET password = 'admin@123' WHERE username = 'admin' AND password LIKE 'scrypt$%';
