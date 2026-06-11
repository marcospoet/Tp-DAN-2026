-- RAG: knowledge base estática (Markdown/PDF) indexada con pgvector.
-- knowledge_sources permite detectar cambios via hash MD5 y evitar re-indexar.

CREATE TABLE IF NOT EXISTS ai.knowledge_sources (
    source       VARCHAR(255) PRIMARY KEY,
    content_hash VARCHAR(32)  NOT NULL,
    indexed_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai.knowledge_chunks (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source      VARCHAR(255) NOT NULL,
    chunk_index INT          NOT NULL,
    content     TEXT         NOT NULL,
    embedding   vector(1536) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON ai.knowledge_chunks(source);
