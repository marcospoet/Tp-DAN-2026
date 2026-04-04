-- ============================================================
-- V1__init_auth_schema.sql
-- Flyway migration — Auth Service
-- Schema: auth
-- ============================================================

-- Tabla de usuarios (credenciales y provider OAuth)
CREATE TABLE IF NOT EXISTS auth.users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),                    -- NULL cuando provider != 'local'
    provider      VARCHAR(50)  NOT NULL DEFAULT 'local',  -- 'local' | 'google' | 'github'
    provider_id   VARCHAR(255),                    -- ID del usuario en el provider OAuth
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Tabla de perfiles (configuracion y preferencias del usuario)
-- Relacion 1-1 con users (misma PK)
CREATE TABLE IF NOT EXISTS auth.profiles (
    id                 UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name          VARCHAR(100) NOT NULL DEFAULT 'Usuario',
    monthly_budget     NUMERIC(15,2) NOT NULL DEFAULT 0,
    profile_mode       VARCHAR(20)  NOT NULL DEFAULT 'standard',  -- 'standard' | 'expenses_only'
    exchange_rate_mode VARCHAR(10)  NOT NULL DEFAULT 'api',       -- 'api' | 'manual'
    usd_rate           NUMERIC(10,2),                             -- cotizacion manual de respaldo
    ai_provider        VARCHAR(20)  NOT NULL DEFAULT 'claude',    -- 'claude' | 'openai' | 'gemini'
    api_key_claude     TEXT,
    api_key_openai     TEXT,
    api_key_gemini     TEXT,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indice para busqueda por email (login frecuente)
CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);

-- Indice para busqueda por provider + provider_id (login OAuth)
CREATE INDEX IF NOT EXISTS idx_users_provider ON auth.users(provider, provider_id);
