-- Indice HNSW para acelerar la busqueda por similitud (cosine) del RAG.
-- Sin este indice, cada query a knowledge_chunks hace un full scan calculando
-- la distancia contra todas las filas.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
    ON ai.knowledge_chunks USING hnsw (embedding vector_cosine_ops);
