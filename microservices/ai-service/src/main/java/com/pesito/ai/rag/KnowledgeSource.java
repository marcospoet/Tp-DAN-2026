package com.pesito.ai.rag;

/**
 * Documento curado de la knowledge base (Markdown o PDF) ya con su texto extraído.
 */
public record KnowledgeSource(String name, String content) {
}
