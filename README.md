# Pharmacy Management System — Backend (port 2195)

Node.js + Express + PostgreSQL. Routes → services → database, with stock-changing flows
(POS sale, GRN, returns, adjustments) run inside database transactions.

## 1. Database
Run the single SQL file (psql or pgAdmin → Query Tool). It is safe on a database that already has data:
it only creates what is missing and updates views, functions and indexes. Run it again after every update.
```
psql -h 192.168.100.1 -U postgres -d Test_Project -f database/schema.sql
```
It creates every table, view and function, the system roles (Super Admin, Branch Manager, Pharmacist, Cashier)
and one login: **admin / admin@123**. No demo data is inserted by schema.sql.

Optional demo data (medicines, stock, suppliers, patients, sales, orders…) — run AFTER schema.sql on an empty database:
```
psql -h 192.168.100.1 -U postgres -d Test_Project -f database/seed.sql
```

Then log in and open **System → Pharmacy Settings**: pharmacy name, logo, phone, head office address, NTN,
email, website, top bar text, print footer note, maximum POS discount and the POS thermal receipt settings. They are used by the sidebar, the top bar, the browser tab
and every print / PDF / Excel export. Branch documents (sale invoice, POS receipt, returns, GRN, purchase order)
print the branch name, address and phone under the pharmacy name.

## 2. Run
```
npm start            # production
npm run dev          # auto-reload while developing
```
`.env` → `PORT=2195`, `DB_HOST=192.168.100.1`, `DB_NAME=Test_Project`, `DB_PASSWORD=2233`,
`SESSION_TTL_MINUTES=30` (sliding session), optional `DB_TIMEZONE` (default Asia/Karachi).
Open port 2195 in the server firewall — the browser calls it directly.

Database backup (System → Database Backup) uses PostgreSQL's `pg_dump`. On Windows it is found automatically in
`C:\Program Files\PostgreSQL\<version>\bin`; otherwise set `BACKUP_PG_DUMP=<full path to pg_dump>` in `.env`.
pg_dump must be the same or a newer version than the PostgreSQL server. Default folder: `backups/` inside this
project (change it on the page, or set `BACKUP_DIR` in `.env`).

Health check: `http://<server>:2195/api/health`

## 3. API
- Full reference: **API.md**
- Postman: import `database/Pharmacy_API.postman_collection.json`, run **Auth → Login** (token is saved automatically),
  then run any request — or run the whole collection top to bottom (it creates, edits and cleans up its own records).
- Automated end-to-end check (use an EMPTY test database): `npm run test:api` → 150 checks,
  then `npm run test:new` → online order cancel, maximum discount and database backup checks.

## Structure
```
server.js                 boots the API (port 2195)
src/app.js                middleware + route mounting
src/config/               db pool, permission registry (must match the frontend)
src/middleware/           auth (session token + per-page permission), error handler
src/routes/               one file per module (sales, purchasing, inventory, credit, reports, admin, lov, masters…)
src/services/stock.js     FEFO allocation + safe batch quantity changes
src/services/backup.js    pg_dump backups + auto backup scheduler
src/utils/                helpers, CRUD builder
database/                 schema.sql (complete setup), seed.sql (demo data), Postman collection
test/                     end-to-end API tests
```
Medicine prices are per single unit. Box / strip sizes only describe the pack type.
