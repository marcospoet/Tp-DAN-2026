package com.pesito.ai.rag.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Embeddings nativos de Google: gemini-embedding-001 truncado a 1536 dims
 * (outputDimensionality) para compartir el almacenamiento con OpenAI.
 * Al truncar, el vector deja de estar normalizado — se re-normaliza acá
 * (recomendación oficial de Google) para que la similitud coseno sea correcta.
 */
@Component
public class GeminiEmbeddingStrategy implements EmbeddingStrategy {

    private static final String BATCH_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents";
    private static final String MODEL = "models/gemini-embedding-001";
    private static final int BATCH_SIZE = 100;
    // Cota al block(): sin esto un proveedor caído deja el hilo colgado indefinidamente
    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    private final WebClient webClient;
    private final ObjectMapper mapper;

    public GeminiEmbeddingStrategy(WebClient webClient, ObjectMapper mapper) {
        this.webClient = webClient;
        this.mapper = mapper;
    }

    @Override
    public String provider() {
        return "gemini";
    }

    @Override
    public List<float[]> embed(List<String> texts, String apiKey) {
        List<float[]> result = new ArrayList<>();
        for (int from = 0; from < texts.size(); from += BATCH_SIZE) {
            List<String> batch = texts.subList(from, Math.min(from + BATCH_SIZE, texts.size()));
            result.addAll(embedBatch(batch, apiKey));
        }
        return result;
    }

    private List<float[]> embedBatch(List<String> texts, String apiKey) {
        ObjectNode body = mapper.createObjectNode();
        ArrayNode requests = body.putArray("requests");
        for (String text : texts) {
            ObjectNode request = requests.addObject();
            request.put("model", MODEL);
            request.putObject("content").putArray("parts").addObject().put("text", text);
            request.put("outputDimensionality", DIMENSIONS);
        }

        JsonNode response = webClient.post()
                .uri(BATCH_URL + "?key=" + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body.toString())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(TIMEOUT);

        List<float[]> result = new ArrayList<>();
        for (JsonNode item : response.path("embeddings")) {
            JsonNode values = item.path("values");
            float[] vector = new float[values.size()];
            for (int i = 0; i < vector.length; i++) {
                vector[i] = (float) values.get(i).asDouble();
            }
            result.add(normalize(vector));
        }
        return result;
    }

    private float[] normalize(float[] vector) {
        double norm = 0;
        for (float v : vector) norm += v * v;
        norm = Math.sqrt(norm);
        if (norm == 0) return vector;
        for (int i = 0; i < vector.length; i++) {
            vector[i] = (float) (vector[i] / norm);
        }
        return vector;
    }
}
