package com.budgetbuddy.transaction.service;

import com.budgetbuddy.transaction.dto.ReceiptResponse;
import com.budgetbuddy.transaction.entity.Receipt;
import com.budgetbuddy.transaction.entity.Transaction;
import com.budgetbuddy.transaction.exception.AccessDeniedException;
import com.budgetbuddy.transaction.exception.MinioException;
import com.budgetbuddy.transaction.exception.TransactionNotFoundException;
import com.budgetbuddy.transaction.repository.ReceiptRepository;
import com.budgetbuddy.transaction.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
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
            throw new AccessDeniedException("No tenés permisos sobre esta transacción");
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
