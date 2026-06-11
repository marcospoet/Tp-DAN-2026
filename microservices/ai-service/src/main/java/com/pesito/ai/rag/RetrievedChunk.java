package com.pesito.ai.rag;

/**
 * Chunk de la knowledge base recuperado por similitud para una query del agente.
 */
public record RetrievedChunk(String source, String content) {
}
