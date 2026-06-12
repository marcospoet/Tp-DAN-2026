package com.pesito.transaction.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

// Update parcial: todos los campos son opcionales, pero si vienen deben ser válidos
public record UpdateTransactionRequest(
        @Size(max = 255, message = "La descripción no puede superar los 255 caracteres.")
        String description,

        @Positive(message = "El monto debe ser mayor a cero.")
        BigDecimal amount,

        @Size(max = 20)
        String type,

        @Size(max = 50)
        String icon,

        @Size(max = 50, message = "La categoría no puede superar los 50 caracteres.")
        String category,

        LocalDate date,

        @Size(max = 500, message = "La observación no puede superar los 500 caracteres.")
        String observation,

        @Size(max = 10)
        String currency,

        @Size(max = 20)
        String exchangeRateType,

        @Size(max = 50)
        String account,

        @Size(max = 20)
        String recurringFrequency,

        Boolean isRecurring
) {}
