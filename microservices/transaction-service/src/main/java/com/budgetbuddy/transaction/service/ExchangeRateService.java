package com.budgetbuddy.transaction.service;

import com.budgetbuddy.transaction.dto.ExchangeRateResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExchangeRateService {

    private final WebClient dolarApiClient;

    /**
     * DTO interno para deserializar la respuesta de DolarAPI.
     * Los nombres coinciden con los campos JSON de la API.
     */
    private record DolarApiRate(
            String casa,
            BigDecimal compra,
            BigDecimal venta,
            String fechaActualizacion
    ) {}

    /**
     * Obtiene todas las cotizaciones del dólar (blue, oficial, tarjeta, mep, etc.)
     */
    public List<ExchangeRateResponse> getAllRates() {
        List<DolarApiRate> rates = dolarApiClient.get()
                .uri("/dolares")
                .retrieve()
                .bodyToFlux(DolarApiRate.class)
                .collectList()
                .block();

        if (rates == null || rates.isEmpty()) {
            throw new RuntimeException("No se pudieron obtener las cotizaciones de DolarAPI");
        }

        return rates.stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Obtiene la cotización de un tipo específico (blue, oficial, tarjeta, mep).
     */
    public ExchangeRateResponse getRate(String type) {
        return getAllRates().stream()
                .filter(r -> r.type().equalsIgnoreCase(type))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Cotización no encontrada: " + type));
    }

    /**
     * Convierte un monto en ARS a USD usando el precio de venta de la cotización indicada.
     * Devuelve el monto en USD redondeado a 2 decimales.
     */
    public BigDecimal convertArsToUsd(BigDecimal amountArs, String exchangeRateType) {
        ExchangeRateResponse rate = getRate(exchangeRateType);
        if (rate.sellPrice().compareTo(BigDecimal.ZERO) == 0) {
            throw new RuntimeException("Precio de venta es 0 para: " + exchangeRateType);
        }
        return amountArs.divide(rate.sellPrice(), 2, RoundingMode.HALF_UP);
    }

    /**
     * Devuelve el precio de venta (cotización) del tipo indicado.
     * Se guarda como tx_rate en la transacción.
     */
    public BigDecimal getSellRate(String exchangeRateType) {
        return getRate(exchangeRateType).sellPrice();
    }

    private ExchangeRateResponse toResponse(DolarApiRate rate) {
        return new ExchangeRateResponse(
                rate.casa(),
                rate.compra(),
                rate.venta(),
                rate.fechaActualizacion()
        );
    }
}
