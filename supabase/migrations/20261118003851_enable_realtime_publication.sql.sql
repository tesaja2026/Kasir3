/*
# Enable Supabase Realtime for didKasir tables

1. What changed
- Adds `stores`, `products`, `customers`, and `transactions` to the `supabase_realtime`
  publication. Without this, postgres_changes events are never delivered, so the store app
  received no realtime notifications when a customer placed an order.

2. Security
- Row Level Security still applies to subscriptions: all four tables already have anon
  SELECT policies (USING (true)), so anon clients will receive change events.
*/

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stores', 'products', 'customers', 'transactions'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
