package com.pesito.ai.service;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.pesito.ai.dto.ChatTurnDto;
import com.pesito.ai.observability.LangfuseService;
import com.pesito.ai.tool.AgentTurnResult;
import com.pesito.ai.tool.ToolCall;
import com.pesito.ai.tool.ToolDefinition;
import com.pesito.ai.tool.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Loop agentic de tool calling: alterna turnos del LLM con ejecución de tools
 * sobre transaction-service hasta que el LLM responde con texto final o se
 * alcanza el máximo de iteraciones.
 *
 * Observabilidad: cada llamada al LLM y cada invocación de tool se loguea
 * por SLF4J y, si Langfuse está configurado, se traza como trace + spans.
 */
@Service
public class ToolExecutorService {

    private static final Logger log = LoggerFactory.getLogger(ToolExecutorService.class);

    private static final int MAX_ITERATIONS = 5;

    private final AiProviderService aiProvider;
    private final ToolRegistry toolRegistry;
    private final FinancialToolsService financialTools;
    private final RagToolService ragTools;
    private final ChatMemoryService chatMemory;
    private final LangfuseService langfuse;

    public ToolExecutorService(AiProviderService aiProvider, ToolRegistry toolRegistry,
                                FinancialToolsService financialTools, RagToolService ragTools,
                                ChatMemoryService chatMemory, LangfuseService langfuse) {
        this.aiProvider = aiProvider;
        this.toolRegistry = toolRegistry;
        this.financialTools = financialTools;
        this.ragTools = ragTools;
        this.chatMemory = chatMemory;
        this.langfuse = langfuse;
    }

    public String runAgentLoop(String userId, String systemPrompt, List<ChatTurnDto> history,
                                String providerOverride, String apiKeyOverride) {
        String provider = aiProvider.resolveProvider(providerOverride);
        String apiKey = aiProvider.resolveKey(provider, apiKeyOverride);
        List<ToolDefinition> tools = toolRegistry.getTools();

        ArrayNode messages = aiProvider.buildInitialMessages(provider, history);

        String lastUserMessage = history.isEmpty() ? "" : history.get(history.size() - 1).getText();
        String traceId = langfuse.startTrace(userId, lastUserMessage);

        String lastText = "";
        int totalInputTokens = 0;
        int totalOutputTokens = 0;
        for (int i = 0; i < MAX_ITERATIONS; i++) {
            log.info("[AGENT] userId={} provider={} iter={} llamando al LLM", userId, provider, i + 1);
            AgentTurnResult result = aiProvider.sendAgentTurn(provider, systemPrompt, messages, tools, apiKey);
            messages.add(result.assistantMessage());
            totalInputTokens += result.inputTokens();
            totalOutputTokens += result.outputTokens();
            langfuse.addGeneration(traceId, "llm-turn-" + (i + 1), provider,
                    lastUserMessage, result.text(), result.inputTokens(), result.outputTokens());

            if (!result.hasToolCalls()) {
                log.info("[AGENT_FINAL] userId={} iters={} replyLen={}",
                        userId, i + 1, result.text() != null ? result.text().length() : 0);
                log.info("[USAGE] userId={} provider={} iters={} inputTokens={} outputTokens={} totalTokens={}",
                        userId, provider, i + 1, totalInputTokens, totalOutputTokens,
                        totalInputTokens + totalOutputTokens);
                langfuse.finishTrace(traceId, result.text());
                return result.text();
            }

            log.info("[AGENT] userId={} iter={} tools solicitadas={}", userId, i + 1, result.toolCalls().size());
            lastText = result.text();
            List<String> toolResults = new ArrayList<>();
            for (ToolCall call : result.toolCalls()) {
                log.info("[TOOL] name={} input={}", call.name(), call.arguments());
                String toolResult = switch (call.name()) {
                    case "search_financial_knowledge" -> ragTools.execute(userId, call, provider, apiKey);
                    case "search_conversation_history" -> chatMemory.executeTool(userId, call, provider, apiKey);
                    default -> financialTools.execute(userId, call);
                };
                log.info("[TOOL_RESULT] name={} output={}", call.name(),
                        toolResult.substring(0, Math.min(300, toolResult.length())));
                log.debug("[TOOL_RESULT_FULL] name={} output={}", call.name(), toolResult);
                langfuse.addSpan(traceId, call.name(), call.arguments(), toolResult);
                toolResults.add(toolResult);
            }
            aiProvider.appendToolResults(provider, messages, result.toolCalls(), toolResults);
        }

        log.warn("[AGENT_FINAL] userId={} alcanzó MAX_ITERATIONS={} sin respuesta final", userId, MAX_ITERATIONS);
        log.info("[USAGE] userId={} provider={} iters={} inputTokens={} outputTokens={} totalTokens={}",
                userId, provider, MAX_ITERATIONS, totalInputTokens, totalOutputTokens,
                totalInputTokens + totalOutputTokens);
        String reply = (lastText != null && !lastText.isBlank())
                ? lastText
                : "Estuve consultando varias fuentes pero no pude terminar de procesar tu pedido. ¿Podés reformularlo de forma más simple?";
        langfuse.finishTrace(traceId, reply);
        return reply;
    }
}
