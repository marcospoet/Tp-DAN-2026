package com.budgetbuddy.transaction.service;

import com.budgetbuddy.transaction.dto.CreateTransactionRequest;
import com.budgetbuddy.transaction.dto.TransactionResponse;
import com.budgetbuddy.transaction.dto.UpdateTransactionRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.UUID;

public interface ITransactionService {

    TransactionResponse create(UUID userId, CreateTransactionRequest request);

    TransactionResponse getById(UUID userId, UUID transactionId);

    Page<TransactionResponse> list(UUID userId, LocalDate from, LocalDate to, Pageable pageable);

    TransactionResponse update(UUID userId, UUID transactionId, UpdateTransactionRequest request);

    void delete(UUID userId, UUID transactionId);

    void deleteAllByUser(UUID userId);
}
