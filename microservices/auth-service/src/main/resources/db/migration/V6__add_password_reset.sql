-- ============================================================
-- V6__add_password_reset.sql
-- Agrega campos para restaurar contraseña por codigo de 6 digitos
-- ============================================================

ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS password_reset_token  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_reset_expiry TIMESTAMPTZ;
