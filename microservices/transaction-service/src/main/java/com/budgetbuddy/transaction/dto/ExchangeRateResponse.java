package com.budgetbuddy.transaction.dto;

import java.math.BigDecimal;

public record ExchangeRateResponse(
        String type,
        BigDecimal buyPrice,
        BigDecimal sellPrice,
        String date
) {}
