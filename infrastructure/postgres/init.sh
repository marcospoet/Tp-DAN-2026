#!/bin/bash
# ============================================================
# Script de inicializacion de PostgreSQL
# Crea schemas y usuarios separados para cada microservicio.
# Garantiza el principio de Single Source of Truth:
#   - auth_user  -> solo accede al schema "auth"
#   - txn_user   -> solo accede al schema "txn"
#
# Requiere las siguientes env vars (inyectadas por docker-compose):
#   AUTH_DB_PASSWORD, TXN_DB_PASSWORD, AI_DB_PASSWORD
# ============================================================
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL

    -- Extensión pgvector (usada por ai-service para RAG)
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Crear schemas
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS txn;
    CREATE SCHEMA IF NOT EXISTS ai;

    -- Crear usuario para auth-service
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'auth_user') THEN
            CREATE ROLE auth_user WITH LOGIN PASSWORD '${AUTH_DB_PASSWORD}';
        END IF;
    END
    \$\$;

    GRANT USAGE, CREATE ON SCHEMA auth TO auth_user;
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

    GRANT USAGE, CREATE ON SCHEMA txn TO txn_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA txn TO txn_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA txn TO txn_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT ALL ON TABLES TO txn_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT ALL ON SEQUENCES TO txn_user;
    REVOKE ALL ON SCHEMA auth FROM txn_user;

    -- Crear usuario para ai-service (RAG: pgvector)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ai_db_user') THEN
            CREATE ROLE ai_db_user WITH LOGIN PASSWORD '${AI_DB_PASSWORD}';
        END IF;
    END
    \$\$;

    GRANT USAGE, CREATE ON SCHEMA ai TO ai_db_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ai TO ai_db_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ai TO ai_db_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA ai GRANT ALL ON TABLES TO ai_db_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA ai GRANT ALL ON SEQUENCES TO ai_db_user;
    REVOKE ALL ON SCHEMA auth FROM ai_db_user;
    REVOKE ALL ON SCHEMA txn FROM ai_db_user;

EOSQL
