-- Embeddings por proveedor: OpenAI y Gemini generan vectores de 1536 dims
-- pero en espacios vectoriales incompatibles. Cada chunk/fuente queda tagueado
-- con el proveedor que lo embebio y las busquedas filtran por proveedor activo.

ALTER TABLE ai.knowledge_chunks
    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'openai';

ALTER TABLE ai.knowledge_sources
    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'openai';

-- La PK pasa de (source) a (source, provider): cada proveedor indexa su copia.
ALTER TABLE ai.knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_pkey;
ALTER TABLE ai.knowledge_sources ADD PRIMARY KEY (source, provider);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_provider ON ai.knowledge_chunks(provider);
