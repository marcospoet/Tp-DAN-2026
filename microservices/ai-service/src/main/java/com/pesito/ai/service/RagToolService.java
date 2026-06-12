package com.pesito.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pesito.ai.rag.RagService;
import com.pesito.ai.rag.RetrievedChunk;
import com.pesito.ai.tool.ToolCall;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Ejecuta la tool search_financial_knowledge.
 *
 * Ruteo según el proveedor activo del usuario (patrón Strategy):
 *   - openai / gemini → búsqueda vectorial con embeddings nativos del proveedor
 *     y la key del propio usuario.
 *   - claude (sin API de embeddings) o documentos pausados → búsqueda keyword.
 */
@Service
public class RagToolService {

    private static final int TOP_K = 5;

    private final RagService ragService;
    private final UserProfileService userProfileService;
    private final ObjectMapper mapper;

    public RagToolService(RagService ragService, UserProfileService userProfileService, ObjectMapper mapper) {
        this.ragService = ragService;
        this.userProfileService = userProfileService;
        this.mapper = mapper;
    }

    public String execute(String userId, ToolCall call, String provider, String apiKey) {
        try {
            String query = call.arguments() != null ? call.arguments().path("query").asText("") : "";
            if (query.isBlank()) {
                return errorJson("Falta el parámetro 'query'.");
            }

            List<RetrievedChunk> chunks = userProfileService.isDocumentsPaused(userId)
                    ? ragService.searchText(query, TOP_K)
                    : ragService.search(query, provider, apiKey, TOP_K)
                            .orElseGet(() -> ragService.searchText(query, TOP_K));

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
