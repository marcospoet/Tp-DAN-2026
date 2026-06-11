package com.pesito.ai.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;

/**
 * Genera embeddings con la API de OpenAI (text-embedding-3-small, 1536 dims),
 * usada tanto para indexar la knowledge base como para embeber las queries del agente.
 */
@Service
public class EmbeddingService {

    private static final String EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
    private static final String MODEL = "text-embedding-3-small";

    private final WebClient webClient;
    private final ObjectMapper mapper;

    public EmbeddingService(WebClient webClient, ObjectMapper mapper) {
        this.webClient = webClient;
        this.mapper = mapper;
    }

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

    public float[] embedOne(String text, String apiKey) {
        return embed(List.of(text), apiKey).get(0);
    }
}
