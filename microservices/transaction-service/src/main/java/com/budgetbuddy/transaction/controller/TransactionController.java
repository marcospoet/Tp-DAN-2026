package com.budgetbuddy.transaction.controller;

import com.budgetbuddy.transaction.dto.CreateTransactionRequest;
import com.budgetbuddy.transaction.dto.TransactionResponse;
import com.budgetbuddy.transaction.dto.UpdateTransactionRequest;
import com.budgetbuddy.transaction.service.ITransactionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Transactions", description = "CRUD de transacciones del usuario autenticado")
public class TransactionController {

    private final ITransactionService transactionService;

    @Operation(summary = "Crear una transacción")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Transacción creada"),
        @ApiResponse(responseCode = "400", description = "Datos inválidos"),
        @ApiResponse(responseCode = "401", description = "Sin autenticación")
    })
    @PostMapping
    public ResponseEntity<TransactionResponse> create(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody CreateTransactionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(transactionService.create(userId, request));
    }

    @Operation(summary = "Listar transacciones del usuario (paginado, filtro opcional por fechas)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Listado obtenido"),
        @ApiResponse(responseCode = "401", description = "Sin autenticación")
    })
    @GetMapping
    public ResponseEntity<Page<TransactionResponse>> list(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @PageableDefault(size = 20, sort = "date") Pageable pageable) {
        return ResponseEntity.ok(transactionService.list(userId, from, to, pageable));
    }

    @Operation(summary = "Obtener una transacción por ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Transacción encontrada"),
        @ApiResponse(responseCode = "404", description = "No encontrada o no pertenece al usuario"),
        @ApiResponse(responseCode = "401", description = "Sin autenticación")
    })
    @GetMapping("/{id}")
    public ResponseEntity<TransactionResponse> getById(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(transactionService.getById(userId, id));
    }

    @Operation(summary = "Actualizar una transacción")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Transacción actualizada"),
        @ApiResponse(responseCode = "404", description = "No encontrada o no pertenece al usuario"),
        @ApiResponse(responseCode = "401", description = "Sin autenticación")
    })
    @PutMapping("/{id}")
    public ResponseEntity<TransactionResponse> update(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id,
            @RequestBody UpdateTransactionRequest request) {
        return ResponseEntity.ok(transactionService.update(userId, id, request));
    }

    @Operation(summary = "Eliminar una transacción")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Transacción eliminada"),
        @ApiResponse(responseCode = "404", description = "No encontrada o no pertenece al usuario"),
        @ApiResponse(responseCode = "401", description = "Sin autenticación")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id) {
        transactionService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
