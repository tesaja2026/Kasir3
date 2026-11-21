/*
# Add product image and store phone columns

1. Modified Tables
- `products`: adds `image_url` (text, nullable). The store app already saves a product image
  (base64 data URL, max 2 MB) into this column; without it every product insert fails.
  Backfill is not needed: existing rows keep NULL and render a placeholder icon.
- `stores`: adds `phone` (text, nullable). The owner can set the store's contact phone number
  in the store app; the customer app shows a "Hubungi Toko" button that calls/WhatsApp it.

2. Security
- No policy changes: both tables already have RLS with anon CRUD policies and grants, and the
  new nullable columns are covered by the existing table-level grants.

3. Notes
- Idempotent: uses ADD COLUMN IF NOT EXISTS so re-running is safe.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone text;
