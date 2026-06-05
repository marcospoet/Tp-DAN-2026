ALTER TABLE txn.transactions
    ADD COLUMN IF NOT EXISTS account            VARCHAR(100) NOT NULL DEFAULT 'Efectivo',
    ADD COLUMN IF NOT EXISTS recurring_frequency VARCHAR(50);
