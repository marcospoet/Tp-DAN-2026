-- ============================================================
-- V5__add_oauth_email_verification.sql
-- Agrega: provider_id (OAuth), email_verified y token de verificacion
-- ============================================================

-- Restaurar provider_id (fue eliminado en V3 cuando OAuth no estaba implementado)
ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);

-- Campos para verificacion de email
ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS email_verified           BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email_verification_expiry TIMESTAMPTZ;

-- Indice para busqueda por provider + provider_id (login OAuth)
CREATE INDEX IF NOT EXISTS idx_users_provider
    ON auth.users(provider, provider_id)
    WHERE provider_id IS NOT NULL;

-- Los usuarios locales existentes ya verificaron su email implicitamente
UPDATE auth.users SET email_verified = true WHERE provider = 'local';
