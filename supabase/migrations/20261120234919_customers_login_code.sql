ALTER TABLE customers ADD COLUMN IF NOT EXISTS login_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_login_code ON customers(login_code);

UPDATE customers
SET login_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
WHERE login_code IS NULL;
