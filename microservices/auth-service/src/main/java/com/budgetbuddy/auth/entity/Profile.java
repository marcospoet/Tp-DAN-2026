package com.budgetbuddy.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "auth", name = "profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Profile {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "id")
    private User user;

    @Column(name = "user_name", nullable = false)
    @Builder.Default
    private String userName = "Usuario";

    @Column(name = "monthly_budget", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal monthlyBudget = BigDecimal.ZERO;

    @Column(name = "profile_mode", nullable = false)
    @Builder.Default
    private String profileMode = "standard";

    @Column(name = "exchange_rate_mode", nullable = false)
    @Builder.Default
    private String exchangeRateMode = "api";

    @Column(name = "usd_rate", precision = 10, scale = 2)
    private BigDecimal usdRate;

    @Column(name = "ai_provider", nullable = false)
    @Builder.Default
    private String aiProvider = "claude";

    @Column(name = "api_key_claude")
    private String apiKeyClaude;

    @Column(name = "api_key_openai")
    private String apiKeyOpenai;

    @Column(name = "api_key_gemini")
    private String apiKeyGemini;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
