package com.pesito.ai.rag;

import com.pgvector.PGvector;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.util.List;
import java.util.Optional;

/**
 * Acceso a las tablas ai.knowledge_sources / ai.knowledge_chunks (pgvector).
 */
@Repository
public class KnowledgeChunkRepository {

    private final JdbcTemplate jdbcTemplate;

    public KnowledgeChunkRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<String> findHash(String source) {
        return jdbcTemplate.query(
                "SELECT content_hash FROM ai.knowledge_sources WHERE source = ?",
                (rs, rowNum) -> rs.getString("content_hash"),
                source
        ).stream().findFirst();
    }

    public void upsertHash(String source, String hash) {
        jdbcTemplate.update("""
                INSERT INTO ai.knowledge_sources (source, content_hash, indexed_at)
                VALUES (?, ?, now())
                ON CONFLICT (source) DO UPDATE SET content_hash = EXCLUDED.content_hash, indexed_at = now()
                """, source, hash);
    }

    public void deleteChunks(String source) {
        jdbcTemplate.update("DELETE FROM ai.knowledge_chunks WHERE source = ?", source);
    }

    public void insertChunk(String source, int chunkIndex, String content, float[] embedding) {
        jdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO ai.knowledge_chunks (source, chunk_index, content, embedding) VALUES (?, ?, ?, ?)");
            ps.setString(1, source);
            ps.setInt(2, chunkIndex);
            ps.setString(3, content);
            ps.setObject(4, new PGvector(embedding));
            return ps;
        });
    }

    public List<RetrievedChunk> searchSimilar(float[] queryEmbedding, int topK) {
        return jdbcTemplate.query(
                "SELECT source, content FROM ai.knowledge_chunks ORDER BY embedding <=> ? LIMIT ?",
                ps -> {
                    ps.setObject(1, new PGvector(queryEmbedding));
                    ps.setInt(2, topK);
                },
                (rs, rowNum) -> new RetrievedChunk(rs.getString("source"), rs.getString("content"))
        );
    }
}
