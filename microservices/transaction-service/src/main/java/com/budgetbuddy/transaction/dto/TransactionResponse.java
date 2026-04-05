package com.budgetbuddy.transaction.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TransactionResponse(
        UUID id,
        UUID userId,
        String description,
        BigDecimal amount,
        String type,
        String icon,
        String category,
        LocalDate date,
        String observation,
        String currency,
        BigDecimal amountUsd,
        BigDecimal txRate,
        String exchangeRateType,
        String receiptUrl,
        boolean isRecurring,
        Instant createdAt,
        Instant updatedAt
) {}
