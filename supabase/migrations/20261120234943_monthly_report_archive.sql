ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_report_reset_at timestamptz;

CREATE TABLE IF NOT EXISTS closed_transactions (
  id uuid PRIMARY KEY,
  store_token text NOT NULL REFERENCES stores(token) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(12,2) NOT NULL DEFAULT 0,
  profit numeric(12,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner','customer')),
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('pending','confirmed','done','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closed_transactions_store_token ON closed_transactions(store_token);
CREATE INDEX IF NOT EXISTS idx_closed_transactions_created_at ON closed_transactions(created_at);

ALTER TABLE closed_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON closed_transactions TO anon, authenticated;

DROP POLICY IF EXISTS "public select closed_transactions" ON closed_transactions;
CREATE POLICY "public select closed_transactions" ON closed_transactions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public insert closed_transactions" ON closed_transactions;
CREATE POLICY "public insert closed_transactions" ON closed_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public update closed_transactions" ON closed_transactions;
CREATE POLICY "public update closed_transactions" ON closed_transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public delete closed_transactions" ON closed_transactions;
CREATE POLICY "public delete closed_transactions" ON closed_transactions FOR DELETE TO anon, authenticated USING (true);
