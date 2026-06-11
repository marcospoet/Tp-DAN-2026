package com.pesito.ai.service;

import com.pesito.ai.model.UserProfile;
import com.pesito.ai.repository.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Memoria de largo plazo del agente: mantiene un perfil por usuario en MongoDB
 * (colección agent_profiles) que sobrevive al límite de turnos de la sesión.
 *
 * El perfil se construye parseando el contexto financiero que envía el
 * frontend en cada chat (línea "Top categorías de gastos (año): X: $..."),
 * y se inyecta como nota al inicio del system prompt de chats futuros.
 */
@Service
public class UserProfileService {

    private static final Logger log = LoggerFactory.getLogger(UserProfileService.class);

    private static final Pattern TOP_CATEGORY_PATTERN =
            Pattern.compile("Top categorías de gastos \\(año\\): ([^:,\\n]+):");

    private final UserProfileRepository repo;

    public UserProfileService(UserProfileRepository repo) {
        this.repo = repo;
    }

    /**
     * Nota de perfil para anteponer al contexto financiero del system prompt.
     * Vacío si el usuario no tiene perfil todavía.
     */
    public String buildProfileNote(String userId) {
        if (userId == null || userId.isBlank()) return "";
        return repo.findById(userId)
                .filter(p -> p.getTopCategory() != null && !p.getTopCategory().isBlank())
                .map(p -> "[Perfil histórico: mayor gasto en " + p.getTopCategory() + "]")
                .orElse("");
    }

    /**
     * Actualiza el perfil a partir del contexto financiero del request.
     * Asíncrono y best-effort: nunca afecta la respuesta del chat.
     */
    @Async
    public void updateFromContext(String userId, String financialContext) {
        if (userId == null || userId.isBlank() || financialContext == null) return;
        try {
            Matcher m = TOP_CATEGORY_PATTERN.matcher(financialContext);
            if (!m.find()) return;
            String topCategory = m.group(1).trim();
            if (topCategory.isEmpty()) return;

            UserProfile profile = repo.findById(userId)
                    .orElseGet(() -> new UserProfile(userId, topCategory));
            profile.setTopCategory(topCategory);
            profile.setUpdatedAt(java.time.LocalDateTime.now());
            repo.save(profile);
            log.debug("[PROFILE] userId={} topCategory={}", userId, topCategory);
        } catch (Exception e) {
            log.warn("[PROFILE] no se pudo actualizar el perfil de userId={}: {}", userId, e.getMessage());
        }
    }
}
