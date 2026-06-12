package com.pesito.ai.rag.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;

/**
 * Embeddings nativos de OpenAI: text-embedding-3-small (1536 dims).
 */
@Component
public class OpenAiEmbeddingStrategy implements EmbeddingStrategy {

    private static final String EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
    private static final String MODEL = "text-embedding-3-small";

    private final WebClient webClient;
    private final ObjectMapper mapper;

    public OpenAiEmbeddingStrategy(WebClient webClient, ObjectMapper mapper) {
        this.webClient = webClient;
        this.mapper = mapper;
    }

    @Override
    public String provider() {
        return "openai";
    }

    @Override
    public List<float[]> embed(List<String> texts, String apiKey) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", MODEL);
        ArrayNode input = body.putArray("input");
        texts.forEach(input::add);

        JsonNode response = webClient.post()
                .uri(EMBEDDINGS_URL)
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body.toString())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        List<float[]> result = new ArrayList<>();
        for (JsonNode item : response.path("data")) {
            JsonNode embeddingNode = item.path("embedding");
            float[] vector = new float[embeddingNode.size()];
            for (int i = 0; i < vector.length; i++) {
                vector[i] = (float) embeddingNode.get(i).asDouble();
            }
            result.add(vector);
        }
        return result;
    }
}
