package com.pesito.transaction.service;

import com.pesito.transaction.dto.ReceiptResponse;
import com.pesito.transaction.entity.Receipt;
import com.pesito.transaction.entity.Transaction;
import com.pesito.transaction.exception.AccessDeniedException;
import com.pesito.transaction.exception.MinioException;
import com.pesito.transaction.exception.TransactionNotFoundException;
import com.pesito.transaction.repository.ReceiptRepository;
import com.pesito.transaction.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReceiptService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "application/pdf"
    );

    private final TransactionRepository transactionRepository;
    private final ReceiptRepository receiptRepository;
    private final MinioService minioService;

    @Transactional
    public ReceiptResponse upload(UUID userId, UUID transactionId, MultipartFile file) {
        validateContentType(file.getContentType());
        Transaction transaction = getOwnedTransaction(userId, transactionId);

        receiptRepository.findByTransactionId(transactionId).ifPresent(existing -> {
            minioService.delete(existing.getFilePath());
            receiptRepository.delete(existing);
        });

        String objectName;
        try {
            objectName = minioService.upload(
                    userId,
                    file.getOriginalFilename(),
                    file.getInputStream(),
                    file.getSize(),
                    file.getContentType()
            );
        } catch (IOException e) {
            throw new MinioException("Error leyendo archivo: " + e.getMessage(), e);
        }

        Receipt receipt = receiptRepository.save(Receipt.builder()
                .transaction(transaction)
                .filePath(objectName)
                .build());

        transaction.setReceiptUrl(objectName);
        transactionRepository.save(transaction);

        log.info("Receipt subido: transactionId={}, path={}", transactionId, objectName);
        return toResponse(receipt, minioService.getPresignedUrl(objectName));
    }

    public record ReceiptDownload(InputStream stream, String contentType) {}

    @Transactional(readOnly = true)
    public ReceiptDownload download(UUID userId, UUID transactionId) {
        getOwnedTransaction(userId, transactionId);
        Receipt receipt = receiptRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("La transacción no tiene comprobante"));
        String path = receipt.getFilePath();
        String ext = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1).toLowerCase() : "";
        String contentType = switch (ext) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png"         -> "image/png";
            case "webp"        -> "image/webp";
            case "pdf"         -> "application/pdf";
            default            -> "application/octet-stream";
        };
        return new ReceiptDownload(minioService.download(path), contentType);
    }

    @Transactional(readOnly = true)
    public String getUrl(UUID userId, UUID transactionId) {
        getOwnedTransaction(userId, transactionId);
        Receipt receipt = receiptRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("La transacción no tiene comprobante"));
        return minioService.getPresignedUrl(receipt.getFilePath());
    }

    @Transactional
    public void delete(UUID userId, UUID transactionId) {
        Transaction transaction = getOwnedTransaction(userId, transactionId);
        Receipt receipt = receiptRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("La transacción no tiene comprobante"));

        minioService.delete(receipt.getFilePath());
        receiptRepository.delete(receipt);

        transaction.setReceiptUrl(null);
        transactionRepository.save(transaction);

        log.info("Receipt eliminado: transactionId={}", transactionId);
    }

    private Transaction getOwnedTransaction(UUID userId, UUID transactionId) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new TransactionNotFoundException(transactionId));
        if (!transaction.getUserId().equals(userId)) {
            throw new AccessDeniedException();
        }
        return transaction;
    }

    private void validateContentType(String contentType) {
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException(
                    "Tipo de archivo no permitido. Se aceptan: JPEG, PNG, WEBP, PDF"
            );
        }
    }

    private ReceiptResponse toResponse(Receipt receipt, String url) {
        return new ReceiptResponse(
                receipt.getId(),
                receipt.getTransaction().getId(),
                url,
                receipt.getUploadedAt()
        );
    }
}
