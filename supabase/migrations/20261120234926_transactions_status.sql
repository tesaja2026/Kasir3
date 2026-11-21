ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done';

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'confirmed', 'done', 'rejected'));

UPDATE transactions SET status = 'done' WHERE status NOT IN ('pending', 'confirmed', 'rejected');
