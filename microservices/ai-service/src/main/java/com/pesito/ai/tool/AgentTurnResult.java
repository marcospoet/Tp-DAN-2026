package com.pesito.ai.tool;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * Resultado de un turno del LLM dentro del loop agentic de tool calling.
 *
 * @param text             texto de la respuesta (puede ser vacío si el turno solo invoca tools)
 * @param toolCalls        tools que el LLM decidió invocar en este turno (vacío si respondió directo)
 * @param assistantMessage mensaje del asistente en el formato nativo del provider, listo para
 *                          agregarse a la conversación antes del siguiente turno
 * @param inputTokens      tokens de entrada reportados por el provider en este turno (0 si no informa)
 * @param outputTokens     tokens de salida reportados por el provider en este turno (0 si no informa)
 */
public record AgentTurnResult(String text, List<ToolCall> toolCalls, JsonNode assistantMessage,
                              int inputTokens, int outputTokens) {

    public boolean hasToolCalls() {
        return toolCalls != null && !toolCalls.isEmpty();
    }
}
