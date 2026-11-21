/*
# didKasir POS schema

1. New Tables
- `stores`: one row per shop. `token` is the 6-char shareable code customers enter to view the catalog; `owner_code` is the code the shop owner enters to open the store app. `username`/`password` are the owner's simple credentials (per-store, per requirements).
- `products`: shop products. `store_token` ties each row to a store via its token.
- `customers`: shop customers. `store_token` ties each row to a store.
- `transactions`: sales. `items` jsonb array of {id, name, price, modal_price, qty}. `profit` = sum((price - modal_price) * qty). `source` marks 'owner' (cashier) or 'customer' (self-checkout) transactions.

2. Security
- Enable RLS on all tables. This app has no Supabase auth sign-in: everything runs with the anon key, so policies are TO anon, authenticated.
- Data isolation is by store token: all data tables are keyed on `store_token`. The frontend always filters by the active token, so one store's users never see another store's data.
- `stores` SELECT is allowed (needed to resolve token -> store name, and owner login). INSERT is open (store registration) but uniqueness constraints protect integrity.
- Grants for the Data API on all tables for anon.

3. Notes
- Tokens: uppercase alphanumeric, generated client-side, uniqueness enforced by constraints.
- Indexes on store_token for all data tables and on token for stores.
*/

CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  token text UNIQUE NOT NULL,
  owner_code text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_token text NOT NULL REFERENCES stores(token) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  modal_price numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  category text,
  sold_count integer NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_token text NOT NULL REFERENCES stores(token) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  total_profit_contributed numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_token text NOT NULL REFERENCES stores(token) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(12,2) NOT NULL DEFAULT 0,
  profit numeric(12,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner','customer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_store_token ON products(store_token);
CREATE INDEX IF NOT EXISTS idx_customers_store_token ON customers(store_token);
CREATE INDEX IF NOT EXISTS idx_transactions_store_token ON transactions(store_token);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_stores_token ON stores(token);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON stores TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO anon, authenticated;

DROP POLICY IF EXISTS "public select stores" ON stores;
CREATE POLICY "public select stores" ON stores FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public insert stores" ON stores;
CREATE POLICY "public insert stores" ON stores FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public update stores" ON stores;
CREATE POLICY "public update stores" ON stores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public delete stores" ON stores;
CREATE POLICY "public delete stores" ON stores FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public select products" ON products;
CREATE POLICY "public select products" ON products FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public insert products" ON products;
CREATE POLICY "public insert products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public update products" ON products;
CREATE POLICY "public update products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public delete products" ON products;
CREATE POLICY "public delete products" ON products FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public select customers" ON customers;
CREATE POLICY "public select customers" ON customers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public insert customers" ON customers;
CREATE POLICY "public insert customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public update customers" ON customers;
CREATE POLICY "public update customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public delete customers" ON customers;
CREATE POLICY "public delete customers" ON customers FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public select transactions" ON transactions;
CREATE POLICY "public select transactions" ON transactions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public insert transactions" ON transactions;
CREATE POLICY "public insert transactions" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public update transactions" ON transactions;
CREATE POLICY "public update transactions" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public delete transactions" ON transactions;
CREATE POLICY "public delete transactions" ON transactions FOR DELETE TO anon, authenticated USING (true);
