#!/bin/bash
# ============================================================
# Script de inicialización de PostgreSQL
# Crea schemas y usuarios separados para cada microservicio.
# Garantiza el principio de Single Source of Truth:
#   - auth_user  → solo accede al schema "auth"
#   - txn_user   → solo accede al schema "txn"
#
# Requiere las siguientes env vars (inyectadas por docker-compose):
#   AUTH_DB_PASSWORD, TXN_DB_PASSWORD
# ============================================================
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL

    -- Crear schemas
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS txn;

    -- Crear usuario para auth-service
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'auth_user') THEN
            CREATE ROLE auth_user WITH LOGIN PASSWORD '${AUTH_DB_PASSWORD}';
        END IF;
    END
    \$\$;

    GRANT USAGE ON SCHEMA auth TO auth_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO auth_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO auth_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO auth_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO auth_user;
    REVOKE ALL ON SCHEMA txn FROM auth_user;

    -- Crear usuario para transaction-service
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'txn_user') THEN
            CREATE ROLE txn_user WITH LOGIN PASSWORD '${TXN_DB_PASSWORD}';
        END IF;
    END
    \$\$;

    GRANT USAGE ON SCHEMA txn TO txn_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA txn TO txn_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA txn TO txn_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT ALL ON TABLES TO txn_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT ALL ON SEQUENCES TO txn_user;
    REVOKE ALL ON SCHEMA auth FROM txn_user;

EOSQL
