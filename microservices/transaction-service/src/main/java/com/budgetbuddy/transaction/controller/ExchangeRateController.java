package com.budgetbuddy.transaction.controller;

import com.budgetbuddy.transaction.dto.ExchangeRateResponse;
import com.budgetbuddy.transaction.service.ExchangeRateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rates")
@RequiredArgsConstructor
@Tag(name = "Exchange Rates", description = "Cotizaciones del dólar en tiempo real (DolarAPI)")
public class ExchangeRateController {

    private final ExchangeRateService exchangeRateService;

    @Operation(summary = "Obtener todas las cotizaciones disponibles",
               description = "Retorna blue, oficial, tarjeta, mep y todas las variantes que expone DolarAPI")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Cotizaciones obtenidas"),
        @ApiResponse(responseCode = "503", description = "DolarAPI no disponible")
    })
    @GetMapping
    public ResponseEntity<List<ExchangeRateResponse>> getAllRates() {
        return ResponseEntity.ok(exchangeRateService.getAllRates());
    }

    @Operation(summary = "Obtener cotización específica",
               description = "Tipos disponibles: blue, oficial, tarjeta, mep")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Cotización encontrada"),
        @ApiResponse(responseCode = "404", description = "Tipo de cotización no encontrado")
    })
    @GetMapping("/{type}")
    public ResponseEntity<ExchangeRateResponse> getRate(@PathVariable String type) {
        return ResponseEntity.ok(exchangeRateService.getRate(type));
    }
}
