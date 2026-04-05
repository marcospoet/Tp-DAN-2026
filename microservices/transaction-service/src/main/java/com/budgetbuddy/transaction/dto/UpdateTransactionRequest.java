package com.budgetbuddy.transaction.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdateTransactionRequest(
        String description,
        BigDecimal amount,
        String type,
        String icon,
        String category,
        LocalDate date,
        String observation,
        String currency,
        String exchangeRateType,
        Boolean isRecurring
) {}
