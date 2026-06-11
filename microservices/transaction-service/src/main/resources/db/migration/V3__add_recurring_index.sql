-- Indice parcial para acelerar findByIsRecurringTrueOrderByDateDesc(),
-- usado por RecurringTransactionScheduler. Sin este indice, esa consulta
-- hace un full scan de txn.transactions.
CREATE INDEX IF NOT EXISTS idx_transactions_is_recurring_date
    ON txn.transactions (date DESC)
    WHERE is_recurring = true;
