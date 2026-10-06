-- =====================================================================
-- Pharmacy Management System — demo (dummy) data
-- Run AFTER database/schema.sql on an empty database:
--   psql -U postgres -d <your_db> -f database/schema.sql
--   psql -U postgres -d <your_db> -f database/seed.sql
-- Login: username admin / password admin@123
-- Rows that already exist are skipped (ON CONFLICT DO NOTHING).
-- =====================================================================

BEGIN;
--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.branches VALUES (1, 'BR-001', 'Main Branch — Gulberg', 'Lahore', 'Main Boulevard, Gulberg III', '042-35761234', 'Imran Shah', 'Active', '2026-10-04 11:29:38.580364+00') ON CONFLICT DO NOTHING;
INSERT INTO public.branches VALUES (2, 'BR-002', 'DHA Phase 5', 'Lahore', 'Khayaban-e-Iqbal, DHA', '042-37189900', 'Sadia Akram', 'Active', '2026-10-04 11:29:38.599904+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: lookups; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.lookups VALUES (1, 'category', 'Analgesic', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (2, 'category', 'Antibiotic', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (3, 'category', 'Antacid', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (4, 'category', 'Respiratory', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (5, 'category', 'Syrups', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (6, 'category', 'Vitamins', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (7, 'category', 'Antiallergic', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (8, 'category', 'Diabetes', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (9, 'uom', 'Tablet', 'Tab') ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (10, 'uom', 'Capsule', 'Cap') ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (11, 'uom', 'Bottle', 'Btl') ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (12, 'uom', 'Inhaler', 'Inh') ON CONFLICT DO NOTHING;
INSERT INTO public.lookups VALUES (13, 'uom', 'Sachet', 'Sch') ON CONFLICT DO NOTHING;


--
-- Data for Name: medicines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.medicines VALUES (1, 'MED-0001', 'Panadol 500mg', 'Paracetamol', 1, 9, '2 x 10', 2, 10, '8964000123451', 3.50, 0.00, 'Active', '2026-10-04 11:29:38.664839+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (2, 'MED-0002', 'Augmentin 625mg', 'Co-amoxiclav', 2, 9, '1 x 6', 1, 6, '8964000123452', 95.00, 5.00, 'Active', '2026-10-04 11:29:38.672505+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (3, 'MED-0003', 'Risek 20mg', 'Omeprazole', 3, 10, '2 x 7', 2, 7, '8964000123453', 22.00, 0.00, 'Active', '2026-10-04 11:29:38.679169+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (4, 'MED-0004', 'Brufen 400mg', 'Ibuprofen', 1, 9, '3 x 10', 3, 10, '8964000123454', 6.00, 0.00, 'Active', '2026-10-04 11:29:38.685457+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (5, 'MED-0005', 'Arinac Forte', 'Ibuprofen + Pseudoephedrine', 7, 9, '1 x 10', 1, 10, '8964000123455', 14.00, 0.00, 'Active', '2026-10-04 11:29:38.693409+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (6, 'MED-0006', 'Ventolin Inhaler', 'Salbutamol', 4, 12, '1 x 1', 1, 1, '8964000123456', 650.00, 0.00, 'Active', '2026-10-04 11:29:38.699914+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (7, 'MED-0007', 'Calpol Syrup 120ml', 'Paracetamol', 5, 11, '1 x 1', 1, 1, '8964000123457', 185.00, 0.00, 'Active', '2026-10-04 11:29:38.707248+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (8, 'MED-0008', 'Flagyl 400mg', 'Metronidazole', 2, 9, '2 x 10', 2, 10, '8964000123458', 4.50, 0.00, 'Active', '2026-10-04 11:29:38.713313+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (9, 'MED-0009', 'Glucophage 500mg', 'Metformin', 8, 9, '5 x 10', 5, 10, '8964000123459', 5.00, 0.00, 'Active', '2026-10-04 11:29:38.719488+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (10, 'MED-0010', 'Surbex-Z', 'Multivitamin + Zinc', 6, 9, '1 x 30', 1, 30, '8964000123460', 12.00, 10.00, 'Active', '2026-10-04 11:29:38.727034+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (11, 'MED-0011', 'ORS Sachet', 'Oral Rehydration Salts', 6, 13, '1 x 1', 1, 1, '8964000123461', 25.00, 0.00, 'Active', '2026-10-04 11:29:38.735164+00') ON CONFLICT DO NOTHING;
INSERT INTO public.medicines VALUES (12, 'MED-0012', 'Rigix 10mg', 'Cetirizine', 7, 9, '1 x 10', 1, 10, '8964000123462', 9.00, 0.00, 'Active', '2026-10-04 11:29:38.743282+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: parties; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.parties VALUES (1, 'supplier', 'SUP-0001', 'GSK Pakistan', NULL, 'Faisal Raza', '021-111475725', NULL, NULL, '2365133', 'DSL-38777', '30 Days Credit', NULL, NULL, NULL, NULL, 'Karachi', false, 0.00, 0.00, 'Active', '2026-10-04 11:29:38.753682+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (2, 'supplier', 'SUP-0002', 'Getz Pharma', NULL, 'Adnan Saeed', '021-38636363', NULL, NULL, '9092075', 'DSL-43000', '45 Days Credit', NULL, NULL, NULL, NULL, 'Karachi', false, 0.00, 0.00, 'Active', '2026-10-04 11:29:38.759431+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (3, 'supplier', 'SUP-0003', 'Searle Pakistan', NULL, 'Hina Qureshi', '021-34528800', NULL, NULL, '5199226', 'DSL-66359', '15 Days Credit', NULL, NULL, NULL, NULL, 'Karachi', false, 0.00, 0.00, 'Active', '2026-10-04 11:29:38.764927+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (4, 'supplier', 'SUP-0004', 'Abbott Laboratories', NULL, 'Kamran Ali', '021-111222688', NULL, NULL, '7023255', 'DSL-86676', 'Cash on Delivery', NULL, NULL, NULL, NULL, 'Karachi', false, 0.00, 0.00, 'Active', '2026-10-04 11:29:38.76986+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (8, 'customer', 'PT-0004', 'Ayesha Noor', NULL, NULL, '0312-3344556', NULL, '35202-2595644-9', NULL, NULL, NULL, 'Female', 29, 'Sulfa drugs', NULL, 'Lahore', false, 0.00, 0.00, 'Active', '2026-10-04 11:29:38.787855+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (10, 'customer', 'PT-0006', 'Shazia Parveen', NULL, NULL, '0302-9876543', NULL, '35202-6571050-7', NULL, NULL, NULL, 'Female', 47, NULL, NULL, 'Lahore', false, 0.00, 0.00, 'Active', '2026-10-04 11:29:38.796497+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (6, 'customer', 'PT-0002', 'Muhammad Rafiq', NULL, NULL, '0321-5566778', NULL, '35202-2496287-2', NULL, NULL, NULL, 'Male', 62, 'Penicillin', NULL, 'Lahore', true, 15000.00, 285.00, 'Active', '2026-10-04 11:29:38.779041+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (7, 'customer', 'PT-0003', 'Nasreen Bibi', NULL, NULL, '0345-6677889', NULL, '35202-8555301-5', NULL, NULL, NULL, 'Female', 55, NULL, NULL, 'Lahore', true, 8000.00, 280.00, 'Active', '2026-10-04 11:29:38.783675+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (5, 'customer', 'PT-0001', 'Ahmed Khan', NULL, NULL, '0300-1234567', NULL, '35202-9861649-5', NULL, NULL, NULL, 'Male', 45, NULL, NULL, 'Lahore', true, 10000.00, 768.00, 'Active', '2026-10-04 11:29:38.774477+00') ON CONFLICT DO NOTHING;
INSERT INTO public.parties VALUES (9, 'customer', 'PT-0005', 'Tariq Mehmood', NULL, NULL, '0333-2211445', NULL, '35202-6906541-8', NULL, NULL, NULL, 'Male', 38, NULL, NULL, 'Lahore', true, 20000.00, 0.00, 'Active', '2026-10-04 11:29:38.792047+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles VALUES (1, 'Super Admin', '{"grn": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "pos": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "uoms": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "admin": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "cities": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "credit": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "finance": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "reports": {"edit": false, "view": true, "print": true, "create": false, "delete": false}, "branches": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "patients": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "dashboard": {"edit": false, "view": true, "print": false, "create": false, "delete": false}, "employees": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "inv-stock": {"edit": false, "view": true, "print": true, "create": false, "delete": true}, "medicines": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "suppliers": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "categories": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "inv-expiry": {"edit": true, "view": true, "print": true, "create": false, "delete": true}, "inv-batches": {"edit": true, "view": true, "print": true, "create": false, "delete": true}, "sale-returns": {"edit": false, "view": true, "print": true, "create": true, "delete": true}, "online-orders": {"edit": true, "view": true, "print": true, "create": false, "delete": true}, "prescriptions": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "sale-invoices": {"edit": false, "view": true, "print": true, "create": false, "delete": true}, "company-profile": {"edit": true, "view": true, "print": false, "create": false, "delete": false}, "database-backup": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "inv-adjustments": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "purchase-orders": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "purchase-returns": {"edit": true, "view": true, "print": true, "create": true, "delete": true}}', true, '2026-10-04 11:29:36.275409+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES (2, 'Branch Manager', '{"grn": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "pos": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "uoms": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "admin": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "cities": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "credit": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "finance": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "reports": {"edit": false, "view": true, "print": true, "create": false, "delete": false}, "branches": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "patients": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "dashboard": {"edit": false, "view": true, "print": false, "create": false, "delete": false}, "employees": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "inv-stock": {"edit": false, "view": true, "print": true, "create": false, "delete": true}, "medicines": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "suppliers": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "categories": {"edit": true, "view": true, "print": false, "create": true, "delete": true}, "inv-expiry": {"edit": true, "view": true, "print": true, "create": false, "delete": true}, "inv-batches": {"edit": true, "view": true, "print": true, "create": false, "delete": true}, "sale-returns": {"edit": false, "view": true, "print": true, "create": true, "delete": true}, "online-orders": {"edit": true, "view": true, "print": true, "create": false, "delete": true}, "prescriptions": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "sale-invoices": {"edit": false, "view": true, "print": true, "create": false, "delete": true}, "company-profile": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "database-backup": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "inv-adjustments": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "purchase-orders": {"edit": true, "view": true, "print": true, "create": true, "delete": true}, "purchase-returns": {"edit": true, "view": true, "print": true, "create": true, "delete": true}}', false, '2026-10-04 11:29:36.275409+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES (3, 'Pharmacist', '{"grn": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "pos": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "uoms": {"edit": true, "view": true, "print": false, "create": true, "delete": false}, "admin": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "cities": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "credit": {"edit": true, "view": true, "print": true, "create": true, "delete": false}, "finance": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "reports": {"edit": false, "view": true, "print": true, "create": false, "delete": false}, "branches": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "patients": {"edit": true, "view": true, "print": true, "create": true, "delete": false}, "dashboard": {"edit": false, "view": true, "print": false, "create": false, "delete": false}, "employees": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "inv-stock": {"edit": false, "view": true, "print": true, "create": false, "delete": false}, "medicines": {"edit": true, "view": true, "print": true, "create": true, "delete": false}, "suppliers": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "categories": {"edit": true, "view": true, "print": false, "create": true, "delete": false}, "inv-expiry": {"edit": true, "view": true, "print": true, "create": false, "delete": false}, "inv-batches": {"edit": true, "view": true, "print": true, "create": false, "delete": false}, "sale-returns": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "online-orders": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "prescriptions": {"edit": true, "view": true, "print": true, "create": true, "delete": false}, "sale-invoices": {"edit": false, "view": true, "print": true, "create": false, "delete": false}, "company-profile": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "database-backup": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "inv-adjustments": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "purchase-orders": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "purchase-returns": {"edit": false, "view": false, "print": false, "create": false, "delete": false}}', false, '2026-10-04 11:29:36.275409+00') ON CONFLICT DO NOTHING;
INSERT INTO public.roles VALUES (4, 'Cashier', '{"grn": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "pos": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "uoms": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "admin": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "cities": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "credit": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "finance": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "reports": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "branches": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "patients": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "dashboard": {"edit": false, "view": true, "print": false, "create": false, "delete": false}, "employees": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "inv-stock": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "medicines": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "suppliers": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "categories": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "inv-expiry": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "inv-batches": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "sale-returns": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "online-orders": {"edit": false, "view": true, "print": true, "create": false, "delete": false}, "prescriptions": {"edit": false, "view": true, "print": true, "create": true, "delete": false}, "sale-invoices": {"edit": false, "view": true, "print": true, "create": false, "delete": false}, "company-profile": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "database-backup": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "inv-adjustments": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "purchase-orders": {"edit": false, "view": false, "print": false, "create": false, "delete": false}, "purchase-returns": {"edit": false, "view": false, "print": false, "create": false, "delete": false}}', false, '2026-10-04 11:29:36.275409+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (1, 'admin', 'admin@123', 'Administrator', 1, 'Active', '2026-10-04 11:29:36.276535+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.transactions VALUES (1, 'PO-2026-0001', 'purchase_order', '2026-10-04 11:29:38.842972+00', 1, NULL, 1, NULL, 'Partially Received', NULL, 22760.00, 0.00, 0.00, 22760.00, NULL, '{"expected_date": "2026-10-08"}', '2026-10-04 11:29:38.842972+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (2, 'PO-2026-0002', 'purchase_order', '2026-10-04 11:29:38.859496+00', 2, NULL, 1, NULL, 'Sent', NULL, 5100.00, 0.00, 0.00, 5100.00, NULL, '{"expected_date": "2026-10-10"}', '2026-10-04 11:29:38.859496+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (3, 'PO-2026-0003', 'purchase_order', '2026-10-04 11:29:38.867555+00', 4, NULL, 1, NULL, 'Draft', NULL, 4800.00, 0.00, 0.00, 4800.00, NULL, '{"expected_date": null}', '2026-10-04 11:29:38.867555+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (4, 'GRN-2026-0001', 'grn', '2026-10-04 11:29:38.875193+00', 1, 1, 1, 1, 'Posted', NULL, 11960.00, 0.00, 0.00, 11960.00, NULL, '{"supplier_invoice": null}', '2026-10-04 11:29:38.875193+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (5, 'GRN-2026-0002', 'grn', '2026-10-04 11:29:38.892027+00', 2, 1, 1, NULL, 'Posted', NULL, 8840.00, 0.00, 0.00, 8840.00, NULL, '{"supplier_invoice": null}', '2026-10-04 11:29:38.892027+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (6, 'GRN-2026-0003', 'grn', '2026-10-04 11:29:38.904783+00', 3, 1, 1, NULL, 'Posted', NULL, 5409.50, 0.00, 0.00, 5409.50, NULL, '{"supplier_invoice": null}', '2026-10-04 11:29:38.904783+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (7, 'GRN-2026-0004', 'grn', '2026-10-04 11:29:38.914302+00', 4, 2, 1, NULL, 'Posted', NULL, 11350.00, 0.00, 0.00, 11350.00, NULL, '{"supplier_invoice": null}', '2026-10-04 11:29:38.914302+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (8, 'INV-2026-0001', 'sale', '2026-10-04 11:29:38.92451+00', NULL, 1, 1, NULL, 'Completed', 'Cash', 378.00, 0.00, 0.00, 378.00, NULL, '{"discount_pct": 0, "customer_type": "walk_in"}', '2026-10-04 11:29:38.92451+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (9, 'INV-2026-0002', 'sale', '2026-10-04 11:29:38.937174+00', 5, 1, 1, NULL, 'Completed', 'Credit', 1268.00, 0.00, 0.00, 1268.00, NULL, '{"discount_pct": 0, "customer_type": "patient"}', '2026-10-04 11:29:38.937174+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (10, 'INV-2026-0003', 'sale', '2026-10-04 11:29:38.948192+00', NULL, 1, 1, NULL, 'Completed', 'Card', 270.00, 0.00, 0.00, 270.00, NULL, '{"discount_pct": 0, "customer_type": "walk_in"}', '2026-10-04 11:29:38.948192+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (11, 'INV-2026-0004', 'sale', '2026-10-04 11:29:38.958145+00', 6, 1, 1, NULL, 'Completed', 'Credit', 300.00, 15.00, 0.00, 285.00, NULL, '{"discount_pct": 5, "customer_type": "patient"}', '2026-10-04 11:29:38.958145+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (12, 'INV-2026-0005', 'sale', '2026-10-04 11:29:38.967774+00', NULL, 2, 1, NULL, 'Completed', 'Digital', 574.00, 0.00, 0.00, 574.00, NULL, '{"discount_pct": 0, "customer_type": "walk_in"}', '2026-10-04 11:29:38.967774+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (13, 'INV-2026-0006', 'sale', '2026-10-04 11:29:38.98059+00', 7, 1, 1, NULL, 'Completed', 'Credit', 280.00, 0.00, 0.00, 280.00, NULL, '{"discount_pct": 0, "customer_type": "patient"}', '2026-10-04 11:29:38.98059+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (14, 'INV-2026-0007', 'sale', '2026-10-04 11:29:38.998182+00', NULL, 2, 1, NULL, 'Completed', 'Cash', 1300.00, 0.00, 0.00, 1300.00, NULL, '{"discount_pct": 0, "customer_type": "walk_in"}', '2026-10-04 11:29:38.998182+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (15, 'INV-2026-0008', 'sale', '2026-10-04 11:29:39.007735+00', 9, 1, 1, NULL, 'Completed', 'Credit', 616.00, 0.00, 0.00, 616.00, NULL, '{"discount_pct": 0, "customer_type": "patient"}', '2026-10-04 11:29:39.007735+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (16, 'INV-2026-0009', 'sale', '2026-10-04 11:29:39.018322+00', NULL, 1, 1, NULL, 'Completed', 'COD', 440.00, 0.00, 0.00, 440.00, NULL, '{"discount_pct": 0, "customer_name": "Zara Ahmed", "customer_type": "online"}', '2026-10-04 11:29:39.018322+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (17, 'INV-2026-0010', 'sale', '2026-10-04 11:29:39.039493+00', NULL, 1, 1, NULL, 'Completed', 'COD', 541.50, 0.00, 0.00, 541.50, NULL, '{"discount_pct": 0, "customer_name": "Bilal Hussain", "customer_type": "online"}', '2026-10-04 11:29:39.039493+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (18, 'INV-2026-0011', 'sale', '2026-10-04 11:29:39.049965+00', NULL, 1, 1, NULL, 'Completed', 'Digital', 458.00, 0.00, 0.00, 458.00, NULL, '{"discount_pct": 0, "customer_name": "Sana Malik", "customer_type": "online"}', '2026-10-04 11:29:39.049965+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (19, 'INV-2026-0012', 'sale', '2026-10-04 11:29:39.060439+00', NULL, 1, 1, NULL, 'Completed', 'COD', 120.00, 0.00, 0.00, 120.00, NULL, '{"discount_pct": 0, "customer_name": "Hamza Ali", "customer_type": "online"}', '2026-10-04 11:29:39.060439+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (20, 'RCPT-2026-0001', 'credit_payment', '2026-10-04 11:29:39.093749+00', 5, NULL, 1, NULL, 'Completed', 'JazzCash', 500.00, 0.00, 0.00, 500.00, NULL, '{}', '2026-10-04 11:29:39.093749+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (21, 'RCPT-2026-0002', 'credit_payment', '2026-10-04 11:29:39.099441+00', 9, NULL, 1, NULL, 'Completed', 'Cash', 616.00, 0.00, 0.00, 616.00, NULL, '{}', '2026-10-04 11:29:39.099441+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (22, 'SR-2026-0001', 'sale_return', '2026-10-04 11:29:39.109546+00', NULL, 1, 1, 10, 'Completed', NULL, 45.00, 0.00, 0.00, 45.00, NULL, '{"reason": "Wrong medicine given", "refund_method": "Cash Refund", "credit_adjusted": false}', '2026-10-04 11:29:39.109546+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (23, 'ADJ-2026-0001', 'adjustment', '2026-10-04 11:29:39.125809+00', NULL, 1, 1, NULL, 'Completed', NULL, 0.00, 0.00, 0.00, 0.00, NULL, '{"reason": "Strip torn during handling", "adj_type": "Damage"}', '2026-10-04 11:29:39.125809+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (24, 'ADJ-2026-0002', 'adjustment', '2026-10-04 11:29:39.132047+00', NULL, 1, 1, NULL, 'Completed', NULL, 0.00, 0.00, 0.00, 0.00, NULL, '{"reason": "Physical count", "adj_type": "Count Correction"}', '2026-10-04 11:29:39.132047+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (25, 'PR-2026-0001', 'purchase_return', '2026-10-04 11:29:39.138458+00', 2, 1, 1, NULL, 'Pending', NULL, 280.00, 0.00, 0.00, 280.00, NULL, '{"reason": "Short Expiry"}', '2026-10-04 11:29:39.138458+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (26, 'RX-2026-0001', 'prescription', '2026-10-04 11:29:39.172489+00', 6, NULL, 1, NULL, 'Partially Dispensed', NULL, 0.00, 0.00, 0.00, 0.00, NULL, '{"doctor": "Dr. Salman Haider", "hospital": "Services Hospital"}', '2026-10-04 11:29:39.172489+00') ON CONFLICT DO NOTHING;
INSERT INTO public.transactions VALUES (27, 'RX-2026-0002', 'prescription', '2026-10-04 11:29:39.17991+00', 8, NULL, 1, NULL, 'Pending', NULL, 0.00, 0.00, 0.00, 0.00, NULL, '{"doctor": "Dr. Farah Naz", "hospital": "Doctors Hospital"}', '2026-10-04 11:29:39.17991+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: batches; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.batches VALUES (10, 12, 1, 3, 6, 'RG-71', '2026-11-30', '2026-10-04', 3.00, 3.00, 6.5000, '2026-10-04 11:29:38.904783+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (13, 1, 2, 4, 7, 'PN-2588', '2026-12-31', '2026-10-04', 400.00, 400.00, 2.5000, '2026-10-04 11:29:38.914302+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (11, 10, 2, 4, 7, 'SZ-14', '2027-08-31', '2026-10-04', 150.00, 120.00, 9.0000, '2026-10-04 11:29:38.914302+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (12, 11, 2, 4, 7, 'ORS-5', '2027-12-31', '2026-10-04', 200.00, 190.00, 18.0000, '2026-10-04 11:29:38.914302+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (6, 5, 1, 2, 5, 'AR-55', '2026-11-30', '2026-10-04', 40.00, 30.00, 10.0000, '2026-10-04 11:29:38.892027+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (14, 6, 2, 4, 7, 'VT-12', '2027-08-31', '2026-10-04', 10.00, 8.00, 540.0000, '2026-10-04 11:29:38.914302+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (4, 7, 1, 2, 5, 'CP-33', '2026-10-31', '2026-10-04', 30.00, 27.00, 140.0000, '2026-10-04 11:29:38.892027+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (2, 2, 1, 1, 4, 'AUG-17', '2027-01-31', '2026-10-04', 120.00, 102.00, 78.0000, '2026-10-04 11:29:38.875193+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (9, 9, 1, 3, 6, 'GL-220', '2027-09-30', '2026-10-04', 600.00, 510.00, 3.6000, '2026-10-04 11:29:38.904783+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (3, 3, 1, 2, 5, 'RS-778', '2026-12-31', '2026-10-04', 200.00, 144.00, 17.0000, '2026-10-04 11:29:38.892027+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (7, 4, 1, 3, 6, 'BF-901', '2027-03-31', '2026-10-04', 400.00, 350.00, 4.2000, '2026-10-04 11:29:38.904783+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (1, 1, 1, 1, 4, 'PN-2602', '2027-06-30', '2026-10-04', 1000.00, 910.00, 2.6000, '2026-10-04 11:29:38.875193+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (8, 8, 1, 3, 6, 'FG-410', '2027-05-31', '2026-10-04', 500.00, 486.00, 3.1000, '2026-10-04 11:29:38.904783+00') ON CONFLICT DO NOTHING;
INSERT INTO public.batches VALUES (5, 7, 1, 2, 5, 'CP-29', '2026-09-30', '2026-10-04', 6.00, 4.00, 140.0000, '2026-10-04 11:29:38.892027+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: cities; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cities VALUES (1, 'Lahore', 'Active', '2026-10-04 11:29:38.535494+00') ON CONFLICT DO NOTHING;
INSERT INTO public.cities VALUES (2, 'Karachi', 'Active', '2026-10-04 11:29:38.563598+00') ON CONFLICT DO NOTHING;
INSERT INTO public.cities VALUES (3, 'Islamabad', 'Active', '2026-10-04 11:29:38.569375+00') ON CONFLICT DO NOTHING;
INSERT INTO public.cities VALUES (4, 'Multan', 'Active', '2026-10-04 11:29:38.575063+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: company_profile; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.company_profile VALUES (1, 'Al-Shifa Pharmacy', '042-35761234', 'Main Boulevard, Gulberg III, Lahore', '4521367-8', 'info@alshifa.pk', 'www.alshifa.pk', NULL, 'This is a system generated document.', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNhODU1ZjciLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM0ZjQ2ZTUiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiByeD0iMjQiIGZpbGw9InVybCgjZykiLz48cGF0aCBkPSJNNTAgMzBoMjB2MjBoMjB2MjBINzB2MjBINTBWNzBIMzBWNTBoMjB6IiBmaWxsPSIjZmZmIi8+PC9zdmc+', 'logo.svg', 'Administrator', '2026-10-04 11:29:48.078531+00', 80, true, true, 1, 'Licensed Pharmacy - DSL No. LHR-04512', 'Thank you for shopping with us! Get well soon.', 'Medicines can be returned within 7 days with the receipt. Fridge items are not returnable.', 10.00) ON CONFLICT DO NOTHING;


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.employees VALUES (1, 'EMP-001', 'Imran Shah', '03676730467', NULL, 'Branch Manager', 1, 'Full Day', '2026-10-04', 'Active', '2026-10-04 11:29:38.801349+00') ON CONFLICT DO NOTHING;
INSERT INTO public.employees VALUES (2, 'EMP-002', 'Bilal Ahmed', '03775209746', NULL, 'Pharmacist', 1, 'Morning (9am - 5pm)', '2026-10-04', 'Active', '2026-10-04 11:29:38.809805+00') ON CONFLICT DO NOTHING;
INSERT INTO public.employees VALUES (3, 'EMP-003', 'Usman Tariq', '03835802535', NULL, 'Delivery Rider', 1, 'Evening (5pm - 1am)', '2026-10-04', 'Active', '2026-10-04 11:29:38.817821+00') ON CONFLICT DO NOTHING;
INSERT INTO public.employees VALUES (4, 'EMP-004', 'Kashif Mehmood', '03292376952', NULL, 'Delivery Rider', 2, 'Morning (9am - 5pm)', '2026-10-04', 'Active', '2026-10-04 11:29:38.825765+00') ON CONFLICT DO NOTHING;
INSERT INTO public.employees VALUES (5, 'EMP-005', 'Sadia Akram', '03259302271', NULL, 'Branch Manager', 2, 'Full Day', '2026-10-04', 'Active', '2026-10-04 11:29:38.830825+00') ON CONFLICT DO NOTHING;
INSERT INTO public.employees VALUES (6, 'EMP-006', 'Hamza Iqbal', '03703833343', NULL, 'Cashier', 2, 'Evening (5pm - 1am)', '2026-10-04', 'Active', '2026-10-04 11:29:38.83746+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: finance_entries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.finance_entries VALUES (1, 'TXN-2026-0001', '2026-10-04', 'Income', 'Credit Recovery', 'JazzCash', 500.00, 'Credit payment RCPT-2026-0001 — Ahmed Khan', NULL, 20, 1, '2026-10-04 11:29:39.093749+00') ON CONFLICT DO NOTHING;
INSERT INTO public.finance_entries VALUES (2, 'TXN-2026-0002', '2026-10-04', 'Income', 'Credit Recovery', 'Cash', 616.00, 'Credit payment RCPT-2026-0002 — Tariq Mehmood', NULL, 21, 1, '2026-10-04 11:29:39.099441+00') ON CONFLICT DO NOTHING;
INSERT INTO public.finance_entries VALUES (3, 'TXN-2026-0003', '2026-10-04', 'Expense', 'Rent', 'Bank Transfer', 85000.00, 'October shop rent — Gulberg', 1, NULL, 1, '2026-10-04 11:29:39.147796+00') ON CONFLICT DO NOTHING;
INSERT INTO public.finance_entries VALUES (4, 'TXN-2026-0004', '2026-10-04', 'Expense', 'Utilities', 'Cash', 18450.00, 'LESCO electricity bill', 1, NULL, 1, '2026-10-04 11:29:39.153763+00') ON CONFLICT DO NOTHING;
INSERT INTO public.finance_entries VALUES (5, 'TXN-2026-0005', '2026-10-04', 'Expense', 'Salaries', 'Bank Transfer', 240000.00, 'September staff salaries', 1, NULL, 1, '2026-10-04 11:29:39.159514+00') ON CONFLICT DO NOTHING;
INSERT INTO public.finance_entries VALUES (6, 'TXN-2026-0006', '2026-10-04', 'Income', 'POS Sales', 'Cash', 125000.00, 'Weekly cash deposit', 1, NULL, 1, '2026-10-04 11:29:39.166519+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: online_orders; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.online_orders VALUES (1, 'ORD-2026-0001', 16, '2026-10-04 11:29:39.018322+00', 'Zara Ahmed', '0345-1122334', 'House 12, Block C, Model Town', 'COD', NULL, 'New', 440.00, 1, '2026-10-04 11:29:39.018322+00') ON CONFLICT DO NOTHING;
INSERT INTO public.online_orders VALUES (4, 'ORD-2026-0004', 19, '2026-10-04 11:29:39.060439+00', 'Hamza Ali', '0333-7788990', 'Faisal Town', 'COD', NULL, 'Preparing', 120.00, 1, '2026-10-04 11:29:39.060439+00') ON CONFLICT DO NOTHING;
INSERT INTO public.online_orders VALUES (3, 'ORD-2026-0003', 18, '2026-10-04 11:29:39.049965+00', 'Sana Malik', '0300-4455667', 'Street 9, Cantt', 'Digital', 'Usman Tariq', 'Out for Delivery', 458.00, 1, '2026-10-04 11:29:39.049965+00') ON CONFLICT DO NOTHING;
INSERT INTO public.online_orders VALUES (2, 'ORD-2026-0002', 17, '2026-10-04 11:29:39.039493+00', 'Bilal Hussain', '0321-9988776', 'Flat 4, Johar Town', 'COD', 'Kashif Mehmood', 'Delivered', 541.50, 1, '2026-10-04 11:29:39.039493+00') ON CONFLICT DO NOTHING;


--
-- Data for Name: transaction_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.transaction_items VALUES (1, 1, 1, NULL, NULL, 1000.00, 2.6000, 2600.00, '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (2, 1, 2, NULL, NULL, 120.00, 78.0000, 9360.00, '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (3, 1, 6, NULL, NULL, 20.00, 540.0000, 10800.00, '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (4, 2, 3, NULL, NULL, 300.00, 17.0000, 5100.00, '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (5, 3, 10, NULL, NULL, 300.00, 9.0000, 2700.00, '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (6, 3, 4, NULL, NULL, 500.00, 4.2000, 2100.00, '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (7, 4, 1, 1, NULL, 1000.00, 2.6000, 2600.00, '{"expiry": "2027-06-30", "batch_no": "PN-2602"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (8, 4, 2, 2, NULL, 120.00, 78.0000, 9360.00, '{"expiry": "2027-01-31", "batch_no": "AUG-17"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (9, 5, 3, 3, NULL, 200.00, 17.0000, 3400.00, '{"expiry": "2026-12-31", "batch_no": "RS-778"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (10, 5, 7, 4, NULL, 30.00, 140.0000, 4200.00, '{"expiry": "2026-10-31", "batch_no": "CP-33"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (11, 5, 7, 5, NULL, 6.00, 140.0000, 840.00, '{"expiry": "2026-09-30", "batch_no": "CP-29"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (12, 5, 5, 6, NULL, 40.00, 10.0000, 400.00, '{"expiry": "2026-11-30", "batch_no": "AR-55"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (13, 6, 4, 7, NULL, 400.00, 4.2000, 1680.00, '{"expiry": "2027-03-31", "batch_no": "BF-901"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (14, 6, 8, 8, NULL, 500.00, 3.1000, 1550.00, '{"expiry": "2027-05-31", "batch_no": "FG-410"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (15, 6, 9, 9, NULL, 600.00, 3.6000, 2160.00, '{"expiry": "2027-09-30", "batch_no": "GL-220"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (16, 6, 12, 10, NULL, 3.00, 6.5000, 19.50, '{"expiry": "2026-11-30", "batch_no": "RG-71"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (17, 7, 10, 11, NULL, 150.00, 9.0000, 1350.00, '{"expiry": "2027-08-31", "batch_no": "SZ-14"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (18, 7, 11, 12, NULL, 200.00, 18.0000, 3600.00, '{"expiry": "2027-12-31", "batch_no": "ORS-5"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (19, 7, 1, 13, NULL, 400.00, 2.5000, 1000.00, '{"expiry": "2026-12-31", "batch_no": "PN-2588"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (20, 7, 6, 14, NULL, 10.00, 540.0000, 5400.00, '{"expiry": "2027-08-31", "batch_no": "VT-12"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (21, 8, 1, 1, NULL, 20.00, 3.5000, 70.00, '{"factor": 1, "batch_no": "PN-2602", "sale_type": "single", "unit_cost": 2.6, "unit_label": "Tablet", "sale_unit_price": 3.5}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (22, 8, 3, 3, NULL, 14.00, 22.0000, 308.00, '{"factor": 1, "batch_no": "RS-778", "sale_type": "single", "unit_cost": 17, "unit_label": "Capsule", "sale_unit_price": 22}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (23, 9, 2, 2, NULL, 12.00, 90.2500, 1083.00, '{"factor": 1, "batch_no": "AUG-17", "sale_type": "single", "unit_cost": 78, "unit_label": "Tablet", "sale_unit_price": 90.25}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (24, 9, 7, 4, NULL, 1.00, 185.0000, 185.00, '{"factor": 1, "batch_no": "CP-33", "sale_type": "single", "unit_cost": 140, "unit_label": "Bottle", "sale_unit_price": 185}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (25, 10, 4, 7, NULL, 30.00, 6.0000, 180.00, '{"factor": 1, "batch_no": "BF-901", "sale_type": "single", "unit_cost": 4.2, "unit_label": "Tablet", "sale_unit_price": 6}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (26, 10, 8, 8, NULL, 20.00, 4.5000, 90.00, '{"factor": 1, "batch_no": "FG-410", "sale_type": "single", "unit_cost": 3.1, "unit_label": "Tablet", "sale_unit_price": 4.5}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (27, 11, 9, 9, NULL, 60.00, 5.0000, 300.00, '{"factor": 1, "batch_no": "GL-220", "sale_type": "single", "unit_cost": 3.6, "unit_label": "Tablet", "sale_unit_price": 5}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (28, 12, 10, 11, NULL, 30.00, 10.8000, 324.00, '{"factor": 1, "batch_no": "SZ-14", "sale_type": "single", "unit_cost": 9, "unit_label": "Tablet", "sale_unit_price": 10.8}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (29, 12, 11, 12, NULL, 10.00, 25.0000, 250.00, '{"factor": 1, "batch_no": "ORS-5", "sale_type": "single", "unit_cost": 18, "unit_label": "Sachet", "sale_unit_price": 25}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (30, 13, 1, 1, NULL, 40.00, 3.5000, 140.00, '{"factor": 1, "batch_no": "PN-2602", "sale_type": "single", "unit_cost": 2.6, "unit_label": "Tablet", "sale_unit_price": 3.5}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (31, 13, 5, 6, NULL, 10.00, 14.0000, 140.00, '{"factor": 1, "batch_no": "AR-55", "sale_type": "single", "unit_cost": 10, "unit_label": "Tablet", "sale_unit_price": 14}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (32, 14, 6, 14, NULL, 2.00, 650.0000, 1300.00, '{"factor": 1, "batch_no": "VT-12", "sale_type": "single", "unit_cost": 540, "unit_label": "Inhaler", "sale_unit_price": 650}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (33, 15, 3, 3, NULL, 28.00, 22.0000, 616.00, '{"factor": 1, "batch_no": "RS-778", "sale_type": "single", "unit_cost": 17, "unit_label": "Capsule", "sale_unit_price": 22}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (34, 16, 1, 1, NULL, 20.00, 3.5000, 70.00, '{"factor": 1, "batch_no": "PN-2602", "sale_type": "single", "unit_cost": 2.6, "unit_label": "Tablet", "sale_unit_price": 3.5}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (35, 16, 7, 4, NULL, 2.00, 185.0000, 370.00, '{"factor": 1, "batch_no": "CP-33", "sale_type": "single", "unit_cost": 140, "unit_label": "Bottle", "sale_unit_price": 185}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (36, 17, 2, 2, NULL, 6.00, 90.2500, 541.50, '{"factor": 1, "batch_no": "AUG-17", "sale_type": "single", "unit_cost": 78, "unit_label": "Tablet", "sale_unit_price": 90.25}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (37, 18, 9, 9, NULL, 30.00, 5.0000, 150.00, '{"factor": 1, "batch_no": "GL-220", "sale_type": "single", "unit_cost": 3.6, "unit_label": "Tablet", "sale_unit_price": 5}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (38, 18, 3, 3, NULL, 14.00, 22.0000, 308.00, '{"factor": 1, "batch_no": "RS-778", "sale_type": "single", "unit_cost": 17, "unit_label": "Capsule", "sale_unit_price": 22}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (39, 19, 4, 7, NULL, 20.00, 6.0000, 120.00, '{"factor": 1, "batch_no": "BF-901", "sale_type": "single", "unit_cost": 4.2, "unit_label": "Tablet", "sale_unit_price": 6}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (40, 22, 8, 8, NULL, 10.00, 4.5000, 45.00, '{"factor": 1, "batch_no": "FG-410", "sale_type": "single", "unit_label": "Tablet", "sale_unit_price": 4.5}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (41, 23, 1, 1, 'Strip torn during handling', -10.00, 2.6000, -26.00, '{"batch_no": "PN-2602"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (42, 24, 8, 8, 'Physical count', -4.00, 3.1000, -12.40, '{"batch_no": "FG-410"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (43, 25, 7, 5, NULL, 2.00, 140.0000, 280.00, '{"batch_no": "CP-29"}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (44, 26, 9, NULL, '1 tab twice daily', 60.00, 0.0000, 0.00, '{"dosage": "1 tab twice daily", "dispensed": 60}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (45, 26, 3, NULL, '1 cap before breakfast', 14.00, 0.0000, 0.00, '{"dosage": "1 cap before breakfast", "dispensed": 0}') ON CONFLICT DO NOTHING;
INSERT INTO public.transaction_items VALUES (46, 27, 12, NULL, '1 tab at night', 10.00, 0.0000, 0.00, '{"dosage": "1 tab at night", "dispensed": 0}') ON CONFLICT DO NOTHING;


--
-- Name: batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.batches_id_seq', 14, true);


--
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.branches_id_seq', 2, true);


--
-- Name: cities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cities_id_seq', 4, true);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 6, true);


--
-- Name: finance_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.finance_entries_id_seq', 6, true);


--
-- Name: lookups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lookups_id_seq', 13, true);


--
-- Name: medicines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.medicines_id_seq', 12, true);


--
-- Name: online_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.online_orders_id_seq', 4, true);


--
-- Name: parties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.parties_id_seq', 10, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 4, true);


--
-- Name: transaction_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transaction_items_id_seq', 46, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 27, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- PostgreSQL database dump complete
--

COMMIT;
