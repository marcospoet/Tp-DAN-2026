package com.budgetbuddy.auth.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ProfileResponse(
    UUID userId,
    String email,
    String userName,
    BigDecimal monthlyBudget,
    String profileMode,
    String exchangeRateMode,
    BigDecimal usdRate,
    String aiProvider
) {}
