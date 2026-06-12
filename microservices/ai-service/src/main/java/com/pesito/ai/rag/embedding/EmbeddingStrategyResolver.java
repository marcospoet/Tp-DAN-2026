package com.pesito.ai.rag.embedding;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Enruta al {@link EmbeddingStrategy} del proveedor activo del usuario.
 * Spring inyecta todas las estrategias registradas; si el proveedor no tiene
 * estrategia (Claude no ofrece API de embeddings), devuelve empty y el
 * llamador degrada a búsqueda por palabras clave.
 */
@Component
public class EmbeddingStrategyResolver {

    private final Map<String, EmbeddingStrategy> strategies;

    public EmbeddingStrategyResolver(List<EmbeddingStrategy> strategies) {
        this.strategies = strategies.stream()
                .collect(Collectors.toMap(EmbeddingStrategy::provider, Function.identity()));
    }

    public Optional<EmbeddingStrategy> forProvider(String provider) {
        if (provider == null) return Optional.empty();
        return Optional.ofNullable(strategies.get(provider.toLowerCase()));
    }

    public boolean supports(String provider) {
        return forProvider(provider).isPresent();
    }
}
