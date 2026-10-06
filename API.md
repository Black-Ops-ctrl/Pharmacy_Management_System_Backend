# Pharmacy API reference (backend port 2195)

All routes are under `/api`. Every route except `POST /auth/login`, `GET /health` and `GET /company` needs
`Authorization: Bearer <token>`. Responses: `{ success: true, data, message? }` or
`{ success: false, error }`. Numbers come back as numbers, dates (DATE columns) as `'YYYY-MM-DD'`,
timestamps as ISO strings. List endpoints accept `?from=YYYY-MM-DD&to=YYYY-MM-DD` where noted.
Permission failures return 403, validation errors 400 with a readable `error` message.

## Auth
| Method | Path | Body / notes |
|---|---|---|
| POST | /auth/login | `{ username, password }` → `{ token, expires_at, user:{id,username,name,role,permissions} }` |
| GET | /auth/me | current user (also extends the 30-min sliding session) |
| POST | /auth/logout | |
| PUT | /auth/password | `{ current_password, new_password }` |

## Pharmacy settings (company profile) — `/company` (one record)
| Method | Path | Body / notes |
|---|---|---|
| GET | /company | public (login screen). `{}` until it is saved. Fields: name, phone, address, ntn, email, website, top_bar_text, print_footer_note, logo (image data URL), logo_name, receipt_width, receipt_copies, receipt_show_logo, receipt_show_barcode, receipt_header, receipt_thanks, receipt_policy, max_discount_pct, updated_by, updated_at |
| PUT | /company | permission `company-profile` › edit. `{ name*, phone*, address*, ntn, email, website, top_bar_text, print_footer_note, logo, logo_name, receipt_width (58/80), receipt_copies (1-3), receipt_show_logo, receipt_show_barcode, receipt_header, receipt_thanks, receipt_policy, max_discount_pct (0-100) }` — empty receipt texts are not printed on the POS receipt; `logo`: `data:image/...;base64,...` (any image type), `null` removes it, leave it out to keep the current one. Body up to 12 MB. |

## Lists of values (any logged-in user) — `/lov/...`
`branches` (id, code, name, city, address, phone) · `cities` (id, name) · `categories` · `uoms` (id, name, symbol) ·
`suppliers` (id, code, name, phone, city) · `customers` (patients: id, code, name, phone, city, credit_allowed, credit_limit, balance) ·
`employees` · `sales` (recent invoices: id, doc_no, txn_date, total, payment_method, customer_name) ·
`purchase-orders?include_id=` (open POs: id, doc_no, party_id, supplier_name, status) · `purchase-orders/:id/items`
(medicine_id, medicine_name, ordered, received, unit_cost) ·
`medicines?branch_id=&with_batches=1&all=1` (id, code, name, generic, category_id, category_name, uom_id, uom_name, pack_type,
box_size, pack_size, price (per unit), discount, sale_price (per unit), barcode, status, stock (sellable, branch-wise if branch_id), batches[] {id,batch_no,expiry,qty}) ·
`batches?medicine_id=&branch_id=&supplier_id=&include_id=` (batches with stock: id, batch_no, expiry, qty, unit_cost, medicine_id, medicine_name, branch_id, branch_name, supplier_id, supplier_name)

## Master data (standard CRUD: GET list, GET /:id, POST, PUT /:id, DELETE /:id)
| Resource | Permission key | Fields (list adds) |
|---|---|---|
| /branches | branches | name*, city, address, phone, manager, status (Active/Opening Soon/Closed); auto `code` BR-001 (list adds staff, today_sales) |
| /cities | cities | name*. Every city appears in all City lists. Renaming updates all records using it; a city in use cannot be deleted |
| /categories, /uoms | categories, uoms | name*, symbol (uom) (list adds medicines count) |
| /employees | employees | name*, phone*, cnic, job_role, branch_id, shift, joined_on, status (Active/On Leave/Terminated); auto code EMP-001; adds branch_name |
| /suppliers | suppliers | name*, phone*, contact_person, email, city, ntn, license_no, payment_terms, address, status (Active/On Hold/Blacklisted); code SUP-0001 (list adds total_purchases, total_returns, po_count, last_supply) |
| /patients | patients | name*, phone*, cnic, gender, age, city, allergies, address, credit_allowed (bool), credit_limit, status; code PT-0001 (list adds total_visits, last_visit; `?from&to` on registration date) |
| /medicines | medicines | name*, generic, category_id*, uom_id*, box_size (strips per box), pack_size (units per strip), barcode (unique, 409 names the medicine that already uses it), price (per single unit), discount (%), status (Active/Inactive); code MED-0001; returns pack_type "2 x 10", sale_price (per unit), category_name, uom_name, stock |
| GET /medicines/barcode-check?code=&exclude_id= | medicines view | `{ used:false }` or `{ used:true, medicine:{id, code, name}, message }` |
| POST /medicines/import | medicines create | `{ rows:[{row, name*, generic, category*, uom*, box_size, pack_size, price, discount, barcode, status}] }` — category / uom by name; all rows are checked first, nothing is saved if any row is wrong: 400 `{ error, errors:[{row, column, message}] }`; 201 `{ imported }` |
| /finance | finance | entry_date, entry_type* (Income/Expense), category, method, amount*, note, branch_id; ref TXN-2026-0001; `?from&to&type=`; entries created by credit payments (source_doc set) cannot be edited/deleted here |

## Inventory — `/inventory` (quantities are BASE units: tablets, capsules, bottles…)
| Method | Path | Notes |
|---|---|---|
| GET | /stock?branch_id= | rows per medicine per branch: medicine_id, code, name, generic, category, uom, branch_id, branch_name, on_hand, expired_qty, stock_value, batch_count, status (Out of Stock = 0, Low Stock = 1 to 4 units, In Stock = 5 or more) |
| GET | /stock/:medicineId?branch_id= | active batches of that medicine |
| DELETE | /stock/:medicineId?branch_id= | writes off all remaining qty as a "Stock Cleared" adjustment (undo by deleting that adjustment) |
| GET | /batches?from=&to=&medicine_id=&branch_id= | date filter = received date. Row: id, batch_no, medicine_id, medicine_name, generic, uom, branch_name, supplier_name, grn_no, received_date, expiry, received_qty, qty, unit_cost, stock_value, days_left, status (Active/Near Expiry/Expired/Consumed) |
| GET | /batches/:id | batch + `movements[] {ref, date, type:'in'|'out', qty, note}` |
| PUT | /batches/:id | `{ batch_no, expiry, unit_cost, qty }` — a qty change is logged as a Count Correction adjustment |
| DELETE | /batches/:id | removes the batch (history lines keep the batch number) |
| GET | /expiry?days=180&from=&to= | batches with stock expiring within `days` (incl. expired), same row shape as batches |
| GET/PUT/DELETE | /expiry/:id | same as batches, checked against inv-expiry permission |
| GET | /adjustments?from=&to=&type= | id, doc_no, txn_date, branch_name, adj_type, reason, created_by, medicine_id, medicine_name, batch_id, batch_no, delta (signed), line_count |
| GET | /adjustments/:id | full document |
| POST | /adjustments | `{ batch_id, adj_type, qty, reason }` — types: Damage, Expiry Write-off, Theft / Loss, Count Correction (qty may be + or −), Return to Supplier. Other types always reduce stock |
| PUT | /adjustments/:id | same body; old movement reversed, new applied |
| DELETE | /adjustments/:id | reverses the movement |

## Sales
| Method | Path | Notes |
|---|---|---|
| GET | /sales?from=&to=&branch_id=&payment= | id, doc_no, txn_date, payment_method, subtotal, discount, total, party_id, customer_name, customer_type, branch_id, branch_name, cashier, item_count, return_count |
| GET | /sales/:id | full invoice: header + `items` (per batch) + `lines[]` {medicine_id, medicine, sale_type ('single'; older invoices may show 'box'/'pack'), unit, qty, price, amount, batch} |
| POST | /sales | POS checkout `{ branch_id, customer_type:'walk_in'|'online'|'patient', party_id (patient), payment_method (Cash/Card/Credit/Digital/COD), discount_pct, items:[{medicine_id, qty (whole units), preferred_batch_id}], online:{customer_name, phone, address, rider} }` — server prices from the medicine (sale_price per unit); out of stock → 400 "<name> is out of stock", FEFO allocation, credit limit check, discount_pct above `max_discount_pct` (Pharmacy Settings) → 400 "Maximum discount allowed is N%", creates Online Order when customer_type='online' |
| DELETE | /sales/:id | stock restored, credit reversed (blocked if the invoice has returns) |
| GET | /sale-returns?from=&to= | id, doc_no, txn_date, total, invoice_no, customer_name, branch_name, refund_method, reason, medicines, qty_summary, qty |
| GET | /sale-returns/:id | full document |
| GET | /sale-returns/invoice/:saleId/lines | `{ invoice, lines[] {medicine_id, medicine, sale_type, unit, qty, price, returned_qty, returnable_qty} }` |
| POST / PUT /:id | /sale-returns | `{ ref_txn_id, refund_method (Cash Refund/Store Credit/Exchange), reason, items:[{medicine_id, sale_type, qty}] }` qty in sale units. Credit invoices reduce the patient balance automatically |
| DELETE | /sale-returns/:id | undoes restock and credit adjustment |
| GET | /online-orders?from=&to=&status= | id, order_no, order_date, customer_name, phone, address, payment, rider, status (New/Preparing/Out for Delivery/Delivered/Cancelled), total, invoice_no, branch_name, item_count |
| GET | /online-orders/:id | + items (invoice lines), subtotal, discount |
| PUT | /online-orders/:id | `{ status, rider, customer_name, phone, address }` (rider required before Out for Delivery). `status:'Cancelled'` puts the stock back into the same batches, reverses credit and marks the invoice Cancelled (excluded from sales totals and reports, cannot be returned). A cancelled order cannot be reopened. Blocked if the invoice has sale returns |
| DELETE | /online-orders/:id | deletes the order AND its invoice, stock restored |

## Purchasing
| Method | Path | Notes |
|---|---|---|
| GET | /purchase-orders?from=&to=&status= | id, doc_no, txn_date, status, total, supplier_name, party_id, expected_date, item_count, total_qty, grn_nos |
| GET / DELETE | /purchase-orders/:id | full doc (items: medicine_id, medicine, qty, unit_price, amount; meta.expected_date). Delete blocked if GRNs exist |
| POST / PUT /:id | /purchase-orders | `{ party_id, expected_date, status (Draft/Sent/Partially Received/Received/Cancelled), notes, items:[{medicine_id, qty, unit_cost}] }` |
| GET | /grn?from=&to= | id, doc_no, txn_date, status, total, supplier_name, party_id, branch_name, branch_id, ref_txn_id, ref_doc_no (PO), item_count, total_qty |
| GET / DELETE | /grn/:id | items: id, medicine_id, medicine, batch_id, batch_no, expiry, qty, unit_price, amount. Delete removes the batches (blocked if any of that stock was used) |
| POST / PUT /:id | /grn | `{ party_id, branch_id, po_id, grn_date, notes, lines:[{ id (existing item when editing), medicine_id, batch_no, expiry ('YYYY-MM' or date), qty (base units), unit_cost (per unit) }] }` — PO status updates automatically |
| GET | /purchase-returns?from=&to= | id, doc_no, txn_date, status (Pending/Dispatched/Credited/Rejected), total, supplier_name, party_id, reason, medicines, batches, total_qty, notes |
| GET / DELETE | /purchase-returns/:id | delete restores stock |
| POST / PUT /:id | /purchase-returns | `{ party_id, reason, note, status, items:[{ batch_id, qty }] }` |

## Patients side
| Method | Path | Notes |
|---|---|---|
| GET | /prescriptions?from=&to=&status= | id, doc_no, rx_date, status (Pending/Partially Dispensed/Dispensed/Expired), patient_name, patient_code, patient_phone, doctor, hospital, item_count, medicines |
| GET / DELETE | /prescriptions/:id | full doc: party_name, meta.doctor, meta.hospital, txn_date, items[] {medicine_id, medicine, qty, meta:{dosage, dispensed}} |
| POST / PUT /:id | /prescriptions | `{ party_id, doctor, hospital, rx_date, status, notes, items:[{medicine_id, qty, dosage, dispensed}] }` |
| GET | /credit?from=&to= | accounts: id (patient id), code, customer, phone, city, credit_allowed, credit_limit, balance, status (Clear/Within Limit/Near Limit/Over Limit), last_payment, last_credit_sale, total_credit_sales, total_paid |
| GET | /credit/:partyId?from=&to= | account + entries[] {id, ref, date, type (Credit Sale/Payment/Sale Return), amount (+ owed / − paid), payment_method, txn_type} |
| PUT | /credit/:partyId | `{ credit_limit, credit_allowed }` |
| DELETE | /credit/:partyId | closes the account (only when balance is 0) |
| POST | /credit/payments | `{ party_id, amount, method, note }` → also creates a Finance "Credit Recovery" income entry |
| DELETE | /credit/payments/:id | reverses a payment |

## Reports
| GET | /reports/dashboard | `{ stats:{today_sales, today_invoices, today_profit, today_returns, low_stock, out_of_stock, pending_pos, expired, expiring_30, today_online_orders}, top_medicines[] {name, revenue, units, percentage}, sales_trend[] {day, total, invoices} (7 days), payment_methods[] {method, total, percentage}, expiry {expired, within_30, within_90, healthy} }` |
|---|---|---|
| GET | /reports/analytics?from=&to= | `{ summary:{total_sales, invoices, total_purchases, total_returns, gross_profit}, trend[] {day, sales, purchases}, top_medicines[] {name, qty, units, revenue}, payment_split[] {name, value(%), total}, branch_sales[] {branch, sales}, invoices[] }` |
| GET | /reports/documents?type=&from=&to= | type: sale-invoices, sale-returns, purchases, grn, purchase-returns. Rows: id, ref, date, status, party, branch, payment, amount, invoice, refund, reason, count, medicine, qty, batch |
| GET | /reports/documents/:id | full document + `lines[] {medicine, batch, qty, price, amount}` |

## Database backup (permission key `database-backup`) — `/backups`
| Method | Path | Notes |
|---|---|---|
| GET | /backups | view. `{ settings:{enabled, every_days, run_time, keep_count, folder}, status:{last_backup_at, last_status, last_message, next_backup_at, running, total_backups, total_size}, backups[] {name, type (Auto/Manual), size, created_at} }` |
| PUT | /backups/settings | edit. `{ enabled, every_days (1-365), run_time 'HH:MM' (24h), keep_count (0 = keep all), folder (full path on the server PC, created if missing) }` |
| POST | /backups | create. Full backup now (all tables, functions and data) with `pg_dump` → `pharmacy_YYYY-MM-DD_HH-mm-ss_manual.sql` |
| GET | /backups/:name/download | view. Downloads the .sql file. Restore: `psql -U postgres -d <empty_db> -f <file>` |
| DELETE | /backups/:name | delete |

The server checks the schedule every minute and takes the auto backup (`..._auto.sql`) at `run_time` every `every_days` days.
If the PC was off at that time, the backup is taken as soon as the server is running again. Older files beyond `keep_count` are removed.

## Admin (permission key `admin`)
`GET/POST /admin/roles`, `PUT/DELETE /admin/roles/:id` (`{ name, permissions:{ pageKey:{view,create,edit,delete,print} } }`, user_count in list;
Super Admin cannot be deleted/renamed, roles in use cannot be deleted) ·
`GET/POST /admin/users`, `PUT/DELETE /admin/users/:id` (`{ username, password, full_name, role_id, status }`; password optional on edit;
you cannot delete or deactivate yourself; deactivating/changing a password logs that user out).
