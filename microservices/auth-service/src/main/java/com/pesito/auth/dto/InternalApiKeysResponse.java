package com.pesito.auth.dto;

public record InternalApiKeysResponse(
    String apiKeyClaude,
    String apiKeyOpenai,
    String apiKeyGemini
) {}
