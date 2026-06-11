package com.pesito.ai.tool;

import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Definición provider-agnóstica de una tool del agente.
 * {@code parameters} es un JSON Schema (subset compatible con Claude input_schema,
 * OpenAI function.parameters y Gemini functionDeclarations.parameters).
 */
public record ToolDefinition(String name, String description, ObjectNode parameters) {
}
