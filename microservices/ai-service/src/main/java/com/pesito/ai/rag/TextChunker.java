package com.pesito.ai.rag;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Divide el texto de un documento en chunks aproximados de ~500 tokens con
 * solapamiento de ~50 tokens, usando palabras como aproximación a tokens.
 */
@Component
public class TextChunker {

    private static final int CHUNK_SIZE_WORDS = 500;
    private static final int OVERLAP_WORDS = 50;

    public List<String> chunk(String text) {
        List<String> chunks = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return chunks;
        }
        String[] words = text.trim().split("\\s+");

        int start = 0;
        while (start < words.length) {
            int end = Math.min(start + CHUNK_SIZE_WORDS, words.length);
            chunks.add(String.join(" ", Arrays.asList(words).subList(start, end)));
            if (end == words.length) {
                break;
            }
            start = end - OVERLAP_WORDS;
        }
        return chunks;
    }
}
