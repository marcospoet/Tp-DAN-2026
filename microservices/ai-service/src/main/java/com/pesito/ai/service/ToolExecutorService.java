package com.pesito.ai.service;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.pesito.ai.dto.ChatTurnDto;
import com.pesito.ai.tool.AgentTurnResult;
import com.pesito.ai.tool.ToolCall;
import com.pesito.ai.tool.ToolDefinition;
import com.pesito.ai.tool.ToolRegistry;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Loop agentic de tool calling: alterna turnos del LLM con ejecución de tools
 * sobre transaction-service hasta que el LLM responde con texto final o se
 * alcanza el máximo de iteraciones.
 */
@Service
public class ToolExecutorService {

    private static final int MAX_ITERATIONS = 5;

    private final AiProviderService aiProvider;
    private final ToolRegistry toolRegistry;
    private final FinancialToolsService financialTools;
    private final RagToolService ragTools;

    public ToolExecutorService(AiProviderService aiProvider, ToolRegistry toolRegistry,
                                FinancialToolsService financialTools, RagToolService ragTools) {
        this.aiProvider = aiProvider;
        this.toolRegistry = toolRegistry;
        this.financialTools = financialTools;
        this.ragTools = ragTools;
    }

    public String runAgentLoop(String userId, String systemPrompt, List<ChatTurnDto> history,
                                String providerOverride, String apiKeyOverride, String userOpenAiKey) {
        String provider = aiProvider.resolveProvider(providerOverride);
        String apiKey = aiProvider.resolveKey(provider, apiKeyOverride);
        List<ToolDefinition> tools = toolRegistry.getTools();

        ArrayNode messages = aiProvider.buildInitialMessages(provider, history);

        String lastText = "";
        for (int i = 0; i < MAX_ITERATIONS; i++) {
            AgentTurnResult result = aiProvider.sendAgentTurn(provider, systemPrompt, messages, tools, apiKey);
            messages.add(result.assistantMessage());

            if (!result.hasToolCalls()) {
                return result.text();
            }

            lastText = result.text();
            List<String> toolResults = new ArrayList<>();
            for (ToolCall call : result.toolCalls()) {
                String toolResult = "search_financial_knowledge".equals(call.name())
                        ? ragTools.execute(call, provider, apiKey, userOpenAiKey)
                        : financialTools.execute(userId, call);
                toolResults.add(toolResult);
            }
            aiProvider.appendToolResults(provider, messages, result.toolCalls(), toolResults);
        }

        return (lastText != null && !lastText.isBlank())
                ? lastText
                : "Estuve consultando varias fuentes pero no pude terminar de procesar tu pedido. ¿Podés reformularlo de forma más simple?";
    }
}
