package com.budgetbuddy.auth.dto;

import java.math.BigDecimal;

public record UpdateProfileRequest(
    String userName,
    BigDecimal monthlyBudget,
    String profileMode,
    String exchangeRateMode,
    BigDecimal usdRate,
    String aiProvider,
    String apiKeyClaude,
    String apiKeyOpenai,
    String apiKeyGemini
) {}
