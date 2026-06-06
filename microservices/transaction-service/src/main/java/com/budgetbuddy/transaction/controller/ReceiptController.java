package com.budgetbuddy.transaction.controller;

import com.budgetbuddy.transaction.dto.ReceiptResponse;
import com.budgetbuddy.transaction.service.ReceiptService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions/{id}/receipt")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Receipts", description = "Gestión de comprobantes adjuntos a transacciones")
public class ReceiptController {

    private final ReceiptService receiptService;

    @Operation(summary = "Descargar comprobante (stream directo — no expone URL de MinIO al browser)")
    @GetMapping
    public ResponseEntity<InputStreamResource> download(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id) {
        ReceiptService.ReceiptDownload dl = receiptService.download(userId, id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(dl.contentType()))
                .body(new InputStreamResource(dl.stream()));
    }

    @Operation(summary = "Subir o reemplazar comprobante (JPEG, PNG, WEBP, PDF — máx. 10 MB)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Comprobante subido, devuelve URL de descarga"),
        @ApiResponse(responseCode = "400", description = "Tipo de archivo no permitido"),
        @ApiResponse(responseCode = "404", description = "Transacción no encontrada"),
        @ApiResponse(responseCode = "403", description = "No pertenece al usuario")
    })
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ReceiptResponse> upload(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(receiptService.upload(userId, id, file));
    }

    @Operation(summary = "Obtener URL de descarga del comprobante (válida 1 hora)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "URL generada"),
        @ApiResponse(responseCode = "400", description = "La transacción no tiene comprobante"),
        @ApiResponse(responseCode = "404", description = "Transacción no encontrada")
    })
    @GetMapping("/url")
    public ResponseEntity<Map<String, String>> getUrl(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(Map.of("url", receiptService.getUrl(userId, id)));
    }

    @Operation(summary = "Eliminar el comprobante de una transacción")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Comprobante eliminado"),
        @ApiResponse(responseCode = "400", description = "La transacción no tiene comprobante"),
        @ApiResponse(responseCode = "404", description = "Transacción no encontrada")
    })
    @DeleteMapping
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id) {
        receiptService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
