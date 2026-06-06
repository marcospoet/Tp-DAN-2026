-- Elimina provider_id de auth.users (campo OAuth nunca utilizado)
DROP INDEX IF EXISTS auth.idx_users_provider;
ALTER TABLE auth.users DROP COLUMN IF EXISTS provider_id;
