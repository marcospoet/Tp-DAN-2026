package com.pesito.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pesito.ai.config.AiProperties;
import com.pesito.ai.rag.RagService;
import com.pesito.ai.rag.RetrievedChunk;
import com.pesito.ai.tool.ToolCall;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Ejecuta la tool search_financial_knowledge (RAG sobre pgvector).
 * Los embeddings siempre usan OpenAI text-embedding-3-small: si el usuario tiene
 * configurada su propia API key de OpenAI se reusa esa key; en cualquier otro caso
 * se usa OPENAI_API_KEY server-side como fallback.
 */
@Service
public class RagToolService {

    private static final int TOP_K = 5;

    private final RagService ragService;
    private final AiProperties aiProperties;
    private final ObjectMapper mapper;

    public RagToolService(RagService ragService, AiProperties aiProperties, ObjectMapper mapper) {
        this.ragService = ragService;
        this.aiProperties = aiProperties;
        this.mapper = mapper;
    }

    public String execute(ToolCall call, String provider, String apiKey, String userOpenAiKey) {
        try {
            String query = call.arguments() != null ? call.arguments().path("query").asText("") : "";
            if (query.isBlank()) {
                return errorJson("Falta el parámetro 'query'.");
            }

            String embeddingKey = (userOpenAiKey != null && !userOpenAiKey.isBlank())
                    ? userOpenAiKey
                    : aiProperties.getOpenaiApiKey();
            if (embeddingKey == null || embeddingKey.isBlank()) {
                return errorJson("RAG requiere una API key de OpenAI (configurada en el servidor o provista por el usuario con provider=openai).");
            }

            List<RetrievedChunk> chunks = ragService.search(query, embeddingKey, TOP_K);

            ObjectNode result = mapper.createObjectNode();
            ArrayNode arr = result.putArray("results");
            for (RetrievedChunk chunk : chunks) {
                ObjectNode node = arr.addObject();
                node.put("source", chunk.source());
                node.put("content", chunk.content());
            }
            return mapper.writeValueAsString(result);
        } catch (Exception e) {
            return errorJson("Error ejecutando search_financial_knowledge: " + e.getMessage());
        }
    }

    private String errorJson(String message) {
        ObjectNode node = mapper.createObjectNode();
        node.put("error", message);
        try {
            return mapper.writeValueAsString(node);
        } catch (Exception e) {
            return "{\"error\":\"" + message.replace("\"", "'") + "\"}";
        }
    }
}
