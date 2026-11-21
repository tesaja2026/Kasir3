/*
# Add order status to transactions

1. Modified Tables
- `transactions`: adds `status` (text, not null, default 'done'). Values:
  - 'pending': order placed from the customer app, waiting for store confirmation
  - 'confirmed': store confirmed the order (stock deducted at this point)
  - 'done': order completed (cashier sales are 'done' immediately)
  - 'rejected': store declined the order (no stock changes)
- Backfills existing rows to 'done'.

2. Security
- No policy changes.
*/

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done';

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'confirmed', 'done', 'rejected'));

UPDATE transactions SET status = 'done' WHERE status NOT IN ('pending', 'confirmed', 'rejected');
