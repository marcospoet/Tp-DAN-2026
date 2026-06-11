package com.pesito.ai.tool;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Representación provider-agnóstica de una invocación de tool decidida por el LLM.
 * {@code id} es el identificador de la llamada (Claude tool_use_id / OpenAI tool_call_id);
 * Gemini no usa id, por lo que puede ser null.
 */
public record ToolCall(String id, String name, JsonNode arguments) {
}
