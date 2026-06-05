package com.budgetbuddy.transaction.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateTransactionRequest(
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
        String account,
        String recurringFrequency,
        boolean isRecurring
) {}
