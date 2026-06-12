package com.pesito.transaction.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateTransactionRequest(
        @NotBlank(message = "La descripción es obligatoria.")
        @Size(max = 255, message = "La descripción no puede superar los 255 caracteres.")
        String description,

        @NotNull(message = "El monto es obligatorio.")
        @Positive(message = "El monto debe ser mayor a cero.")
        BigDecimal amount,

        @NotBlank(message = "El tipo es obligatorio.")
        @Size(max = 20)
        String type,

        @Size(max = 50)
        String icon,

        @Size(max = 50, message = "La categoría no puede superar los 50 caracteres.")
        String category,

        @NotNull(message = "La fecha es obligatoria.")
        LocalDate date,

        @Size(max = 500, message = "La observación no puede superar los 500 caracteres.")
        String observation,

        @Size(max = 10)
        String currency,

        @Positive(message = "El monto en USD debe ser mayor a cero.")
        BigDecimal amountUsd,

        @Positive(message = "La cotización debe ser mayor a cero.")
        BigDecimal txRate,

        @Size(max = 20)
        String exchangeRateType,

        @Size(max = 50)
        String account,

        @Size(max = 20)
        String recurringFrequency,

        boolean isRecurring
) {}
