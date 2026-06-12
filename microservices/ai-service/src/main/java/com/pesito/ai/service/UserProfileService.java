package com.pesito.ai.service;

import com.pesito.ai.model.UserProfile;
import com.pesito.ai.rag.embedding.EmbeddingStrategy;
import com.pesito.ai.rag.embedding.EmbeddingStrategyResolver;
import com.pesito.ai.repository.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.Optional;
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

    private static final int SUMMARY_STALENESS_DAYS = 30;

    private static final String PROFILE_SUMMARY_PROMPT = """
            Sos un analista financiero. A partir de los resúmenes mensuales en JSON que te paso \
            (mes actual y mes anterior), escribí un perfil del usuario de 3-4 oraciones en español \
            rioplatense: distribución del gasto por categoría (con porcentajes aproximados), gasto \
            mensual promedio, y tasa de ahorro ((ingresos - egresos) / ingresos). Si no hay datos \
            suficientes, decilo en una oración. Respondé solo el texto del perfil, sin markdown ni JSON.""";

    private final UserProfileRepository repo;
    private final FinancialToolsService financialTools;
    private final AiProviderService aiProvider;
    private final EmbeddingStrategyResolver embeddings;

    public UserProfileService(UserProfileRepository repo, FinancialToolsService financialTools,
                              AiProviderService aiProvider, EmbeddingStrategyResolver embeddings) {
        this.repo = repo;
        this.financialTools = financialTools;
        this.aiProvider = aiProvider;
        this.embeddings = embeddings;
    }

    // ── Pausa de documentos (Caso B del cambio de proveedor) ─────────────────

    /** Si está pausado, las búsquedas semánticas degradan a keyword sin consumir tokens. */
    public boolean isDocumentsPaused(String userId) {
        if (userId == null || userId.isBlank()) return false;
        return repo.findById(userId).map(UserProfile::isDocumentsPaused).orElse(false);
    }

    public void setDocumentsPaused(String userId, boolean paused) {
        UserProfile profile = repo.findById(userId).orElseGet(() -> {
            UserProfile p = new UserProfile();
            p.setUserId(userId);
            return p;
        });
        profile.setDocumentsPaused(paused);
        profile.setUpdatedAt(LocalDateTime.now());
        repo.save(profile);
        log.info("[PROFILE] userId={} documentsPaused={}", userId, paused);
    }

    /**
     * Nota de perfil para anteponer al contexto financiero del system prompt.
     * Prefiere el perfil semántico generado por LLM; si no existe, cae a la
     * nota simple de top categoría. Vacío si el usuario no tiene perfil.
     */
    public String buildProfileNote(String userId) {
        if (userId == null || userId.isBlank()) return "";
        return repo.findById(userId)
                .map(p -> {
                    if (p.getSummary() != null && !p.getSummary().isBlank()) {
                        return "[Perfil financiero del usuario: " + p.getSummary() + "]";
                    }
                    if (p.getTopCategory() != null && !p.getTopCategory().isBlank()) {
                        return "[Perfil histórico: mayor gasto en " + p.getTopCategory() + "]";
                    }
                    return "";
                })
                .orElse("");
    }

    /**
     * Regenera el perfil financiero semántico si está vencido (> 30 días) o no
     * existe: pide los resúmenes del mes actual y el anterior, se los pasa a un
     * LLM liviano para redactar el perfil, lo embebe (si hay key de OpenAI) y
     * lo persiste. Asíncrono y best-effort: nunca afecta la respuesta del chat.
     */
    @Async
    public void maybeRegenerateSummary(String userId, String provider, String apiKey) {
        if (userId == null || userId.isBlank() || provider == null || provider.isBlank()
                || apiKey == null || apiKey.isBlank()) {
            return;
        }
        try {
            UserProfile profile = repo.findById(userId).orElseGet(() -> {
                UserProfile p = new UserProfile();
                p.setUserId(userId);
                return p;
            });
            if (profile.getSummaryGeneratedAt() != null
                    && profile.getSummaryGeneratedAt().isAfter(LocalDateTime.now().minusDays(SUMMARY_STALENESS_DAYS))) {
                return;
            }

            YearMonth now = YearMonth.now();
            String data = "Mes actual (" + now + "): " + financialTools.getMonthlySummaryJson(userId, now)
                    + "\nMes anterior (" + now.minusMonths(1) + "): "
                    + financialTools.getMonthlySummaryJson(userId, now.minusMonths(1));

            String summary = aiProvider.callSingleTurn(PROFILE_SUMMARY_PROMPT, data, null, null, provider, apiKey);
            if (summary == null || summary.isBlank()) return;
            summary = summary.trim();

            float[] embedding = null;
            String embeddingProvider = null;
            Optional<EmbeddingStrategy> strategy = embeddings.forProvider(provider);
            if (strategy.isPresent() && !isDocumentsPaused(userId)) {
                try {
                    embedding = strategy.get().embedOne(summary, apiKey);
                    embeddingProvider = strategy.get().provider();
                } catch (Exception e) {
                    log.warn("[PROFILE] embedding del perfil falló para userId={}: {}", userId, e.getMessage());
                }
            }

            profile.setSummary(summary);
            profile.setSummaryEmbedding(embedding);
            profile.setSummaryEmbeddingProvider(embeddingProvider);
            profile.setSummaryGeneratedAt(LocalDateTime.now());
            profile.setUpdatedAt(LocalDateTime.now());
            repo.save(profile);
            log.info("[PROFILE] perfil semántico regenerado userId={} len={} embedded={}",
                    userId, summary.length(), embedding != null);
        } catch (Exception e) {
            log.warn("[PROFILE] no se pudo regenerar el perfil semántico de userId={}: {}", userId, e.getMessage());
        }
    }

    /**
     * Re-embebe el resumen del perfil con el proveedor nuevo (migración Caso B).
     */
    public void reembedSummary(String userId, String provider, String apiKey) {
        repo.findById(userId).ifPresent(profile -> {
            if (profile.getSummary() == null || profile.getSummary().isBlank()) return;
            embeddings.forProvider(provider).ifPresent(strategy -> {
                try {
                    profile.setSummaryEmbedding(strategy.embedOne(profile.getSummary(), apiKey));
                    profile.setSummaryEmbeddingProvider(strategy.provider());
                    profile.setUpdatedAt(LocalDateTime.now());
                    repo.save(profile);
                } catch (Exception e) {
                    log.warn("[PROFILE] re-embed del perfil falló para userId={}: {}", userId, e.getMessage());
                }
            });
        });
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
