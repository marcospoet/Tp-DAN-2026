-- ============================================================
-- Script de inicialización de PostgreSQL
-- Crea schemas y usuarios separados para cada microservicio
-- Garantiza el principio de Single Source of Truth
-- ============================================================

-- Crear schema para auth-service
CREATE SCHEMA IF NOT EXISTS auth;

-- Crear schema para transaction-service
CREATE SCHEMA IF NOT EXISTS txn;

-- Crear usuario exclusivo para auth-service
-- Solo tiene acceso al schema "auth"
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'auth_user') THEN
        CREATE ROLE auth_user WITH LOGIN PASSWORD 'cambiar_por_env';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA auth TO auth_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO auth_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO auth_user;

-- auth_user NO TIENE acceso al schema txn (Single Source of Truth)
REVOKE ALL ON SCHEMA txn FROM auth_user;

-- Crear usuario exclusivo para transaction-service
-- Solo tiene acceso al schema "txn"
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'txn_user') THEN
        CREATE ROLE txn_user WITH LOGIN PASSWORD 'cambiar_por_env';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA txn TO txn_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA txn TO txn_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA txn TO txn_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT ALL ON TABLES TO txn_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT ALL ON SEQUENCES TO txn_user;

-- txn_user NO TIENE acceso al schema auth (Single Source of Truth)
REVOKE ALL ON SCHEMA auth FROM txn_user;
