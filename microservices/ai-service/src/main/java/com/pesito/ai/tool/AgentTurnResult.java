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
 */
public record AgentTurnResult(String text, List<ToolCall> toolCalls, JsonNode assistantMessage) {

    public boolean hasToolCalls() {
        return toolCalls != null && !toolCalls.isEmpty();
    }
}
