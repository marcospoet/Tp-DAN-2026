package com.budgetbuddy.transaction.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(schema = "txn", name = "transactions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String type;

    private String icon;

    private String category;

    @Column(nullable = false)
    private LocalDate date;

    private String observation;

    @Column(nullable = false)
    @Builder.Default
    private String currency = "ARS";

    @Column(name = "amount_usd")
    private BigDecimal amountUsd;

    @Column(name = "tx_rate")
    private BigDecimal txRate;

    @Column(name = "exchange_rate_type")
    private String exchangeRateType;

    @Column(name = "receipt_url")
    private String receiptUrl;

    @Column(name = "is_recurring", nullable = false)
    @Builder.Default
    private boolean isRecurring = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
