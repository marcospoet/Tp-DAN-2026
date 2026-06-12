package com.pesito.ai.rag;

import com.pgvector.PGvector;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.util.List;
import java.util.Optional;

/**
 * Acceso a las tablas ai.knowledge_sources / ai.knowledge_chunks (pgvector).
 * Todo está particionado por proveedor de embeddings: los vectores de OpenAI
 * y Gemini comparten dimensión (1536) pero no son comparables entre sí.
 */
@Repository
public class KnowledgeChunkRepository {

    private final JdbcTemplate jdbcTemplate;

    public KnowledgeChunkRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<String> findHash(String source, String provider) {
        return jdbcTemplate.query(
                "SELECT content_hash FROM ai.knowledge_sources WHERE source = ? AND provider = ?",
                (rs, rowNum) -> rs.getString("content_hash"),
                source, provider
        ).stream().findFirst();
    }

    public void upsertHash(String source, String provider, String hash) {
        jdbcTemplate.update("""
                INSERT INTO ai.knowledge_sources (source, provider, content_hash, indexed_at)
                VALUES (?, ?, ?, now())
                ON CONFLICT (source, provider) DO UPDATE SET content_hash = EXCLUDED.content_hash, indexed_at = now()
                """, source, provider, hash);
    }

    public void deleteChunks(String source, String provider) {
        jdbcTemplate.update("DELETE FROM ai.knowledge_chunks WHERE source = ? AND provider = ?", source, provider);
    }

    public void insertChunk(String source, String provider, int chunkIndex, String content, float[] embedding) {
        jdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO ai.knowledge_chunks (source, provider, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?)");
            ps.setString(1, source);
            ps.setString(2, provider);
            ps.setInt(3, chunkIndex);
            ps.setString(4, content);
            ps.setObject(5, new PGvector(embedding));
            return ps;
        });
    }

    public List<RetrievedChunk> searchSimilar(float[] queryEmbedding, String provider, int topK) {
        return jdbcTemplate.query(
                "SELECT source, content FROM ai.knowledge_chunks WHERE provider = ? ORDER BY embedding <=> ? LIMIT ?",
                ps -> {
                    ps.setString(1, provider);
                    ps.setObject(2, new PGvector(queryEmbedding));
                    ps.setInt(3, topK);
                },
                (rs, rowNum) -> new RetrievedChunk(rs.getString("source"), rs.getString("content"))
        );
    }
}
