-- ============================================================
-- V1__init_txn_schema.sql
-- Flyway migration — Transaction Service
-- Schema: txn
-- ============================================================

-- Tabla principal de transacciones financieras
CREATE TABLE IF NOT EXISTS txn.transactions (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

    -- user_id es FK logica (no FK fisica) hacia auth.users.
    -- Son schemas distintos accedidos por servicios distintos.
    -- La integridad se garantiza via evento async user.deleted en RabbitMQ.
    user_id            UUID          NOT NULL,

    description        VARCHAR(255)  NOT NULL,
    amount             NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    type               VARCHAR(10)   NOT NULL CHECK (type IN ('income', 'expense')),
    icon               VARCHAR(50),
    category           VARCHAR(50),
    date               DATE          NOT NULL,
    observation        TEXT,

    -- Multi-currency: ARS o USD
    currency           VARCHAR(3)    NOT NULL DEFAULT 'ARS',
    amount_usd         NUMERIC(15,2),

    -- Cotizacion ARS/USD bloqueada en el momento de la transaccion (inmutable)
    tx_rate            NUMERIC(10,2),
    exchange_rate_type VARCHAR(20),              -- 'BLUE' | 'OFICIAL' | 'TARJETA' | 'MEP' | 'MANUAL'

    -- Comprobante adjunto (path en MinIO/S3)
    receipt_url        TEXT,

    -- Flag para transacciones recurrentes (alquiler, gym, suscripciones)
    is_recurring       BOOLEAN       NOT NULL DEFAULT false,

    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Tabla de comprobantes (receipts)
-- Relacion N-1 con transactions (una transaccion puede tener un comprobante)
CREATE TABLE IF NOT EXISTS txn.receipts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID        NOT NULL REFERENCES txn.transactions(id) ON DELETE CASCADE,
    file_path       TEXT        NOT NULL,     -- path en MinIO: receipts/{userId}/{uuid}.jpg
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices de busqueda frecuente
CREATE INDEX IF NOT EXISTS idx_transactions_user_id   ON txn.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date      ON txn.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON txn.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type      ON txn.transactions(user_id, type);
