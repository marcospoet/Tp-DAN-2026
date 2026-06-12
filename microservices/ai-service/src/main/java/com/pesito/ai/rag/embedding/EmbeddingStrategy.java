package com.pesito.ai.rag.embedding;

import java.util.List;

/**
 * Estrategia de generación de embeddings por proveedor de IA (patrón Strategy).
 *
 * Cada proveedor con API nativa de embeddings implementa esta interfaz y se
 * registra como bean de Spring; {@link EmbeddingStrategyResolver} enruta según
 * el proveedor activo del usuario. Claude (Anthropic) no tiene API de
 * embeddings, por lo que no existe estrategia para él: el sistema degrada a
 * búsqueda por palabras clave.
 *
 * Todos los vectores se generan en 1536 dimensiones para compartir el mismo
 * almacenamiento (pgvector / MongoDB), pero NUNCA se comparan vectores de
 * proveedores distintos — los espacios vectoriales no son compatibles.
 */
public interface EmbeddingStrategy {

    int DIMENSIONS = 1536;

    /** Identificador del proveedor ("openai", "gemini"). */
    String provider();

    /** Genera embeddings de 1536 dims para una lista de textos con la key del usuario. */
    List<float[]> embed(List<String> texts, String apiKey);

    default float[] embedOne(String text, String apiKey) {
        return embed(List.of(text), apiKey).get(0);
    }
}
