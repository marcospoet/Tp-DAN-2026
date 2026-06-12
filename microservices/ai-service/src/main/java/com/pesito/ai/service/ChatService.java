package com.pesito.ai.service;

import com.pesito.ai.config.AiProperties;
import com.pesito.ai.dto.ChatRequest;
import com.pesito.ai.dto.ChatResponse;
import com.pesito.ai.dto.ChatTurnDto;
import com.pesito.ai.model.ChatMessage;
import com.pesito.ai.model.ChatSession;
import com.pesito.ai.repository.ChatSessionRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;



@Service
public class ChatService {

    private static final int MAX_SESSIONS_PER_USER = 10;

    private final ChatSessionRepository sessionRepo;
    private final AiProviderService aiProvider;
    private final PromptService prompts;
    private final ToolExecutorService toolExecutor;
    private final AiProperties aiProperties;
    private final UserProfileService userProfileService;
    private final ChatMemoryService chatMemoryService;

    public ChatService(ChatSessionRepository sessionRepo,
                       AiProviderService aiProvider,
                       PromptService prompts,
                       ToolExecutorService toolExecutor,
                       AiProperties aiProperties,
                       UserProfileService userProfileService,
                       ChatMemoryService chatMemoryService) {
        this.sessionRepo = sessionRepo;
        this.aiProvider = aiProvider;
        this.prompts = prompts;
        this.toolExecutor = toolExecutor;
        this.aiProperties = aiProperties;
        this.userProfileService = userProfileService;
        this.chatMemoryService = chatMemoryService;
    }

    public ChatResponse chat(ChatRequest req) {
        return chat(req, null, null);
    }

    public ChatResponse chat(ChatRequest req, String providerOverride, String apiKeyOverride) {
        String userId = req.getUserId() != null ? req.getUserId() : "anonymous";

        // Load or create session
        ChatSession session;
        if (req.getSessionId() != null) {
            session = sessionRepo.findById(req.getSessionId())
                    .orElseGet(() -> new ChatSession(userId));
        } else {
            session = sessionRepo.findTopByUserIdOrderByUpdatedAtDesc(userId)
                    .orElseGet(() -> new ChatSession(userId));
        }

        // Build history from session + incoming history if provided
        List<ChatTurnDto> history = buildHistory(req, session);

        // Build system prompt with financial context + long-term profile note
        String profileNote = userProfileService.buildProfileNote(userId);
        String contextWithProfile = profileNote.isBlank()
                ? req.getFinancialContext()
                : profileNote + "\n" + (req.getFinancialContext() != null ? req.getFinancialContext() : "");
        String systemPrompt = prompts.buildChatSystemPrompt(contextWithProfile);

        // Call AI — agentic loop with tools when enabled, plain chat otherwise
        String reply = aiProperties.isToolsEnabled()
                ? toolExecutor.runAgentLoop(userId, systemPrompt, history, providerOverride, apiKeyOverride)
                : aiProvider.callChat(systemPrompt, history, providerOverride, apiKeyOverride);

        // Persist the new exchange
        session.addMessage(new ChatMessage("user", req.getMessage()));
        session.addMessage(new ChatMessage("assistant", reply));
        session = sessionRepo.save(session);
        enforceSessionLimit(userId);

        // Long-term memory in background (never blocks the reply):
        // semantic memory of the exchange + profile update
        chatMemoryService.remember(userId, session.getId(), "user", req.getMessage(), providerOverride, apiKeyOverride);
        chatMemoryService.remember(userId, session.getId(), "assistant", reply, providerOverride, apiKeyOverride);
        userProfileService.updateFromContext(userId, req.getFinancialContext());
        userProfileService.maybeRegenerateSummary(userId, providerOverride, apiKeyOverride);

        return new ChatResponse(reply.trim(), session.getId());
    }

    private void enforceSessionLimit(String userId) {
        List<ChatSession> sessions = sessionRepo.findByUserIdOrderByUpdatedAtDesc(userId);
        if (sessions.size() > MAX_SESSIONS_PER_USER) {
            sessionRepo.deleteAll(sessions.subList(MAX_SESSIONS_PER_USER, sessions.size()));
        }
    }

    private List<ChatTurnDto> buildHistory(ChatRequest req, ChatSession session) {
        // If client sends full history, use it (includes current user message)
        if (req.getHistory() != null && !req.getHistory().isEmpty()) {
            return req.getHistory();
        }
        // Otherwise reconstruct from persisted session + new message
        List<ChatTurnDto> history = new ArrayList<>();
        for (ChatMessage msg : session.getMessages()) {
            ChatTurnDto turn = new ChatTurnDto();
            turn.setRole(msg.getRole());
            turn.setText(msg.getContent());
            history.add(turn);
        }
        ChatTurnDto current = new ChatTurnDto();
        current.setRole("user");
        current.setText(req.getMessage());
        history.add(current);
        return history;
    }
}
