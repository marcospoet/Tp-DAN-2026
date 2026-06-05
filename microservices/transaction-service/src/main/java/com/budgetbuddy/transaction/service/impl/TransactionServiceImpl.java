package com.budgetbuddy.transaction.service.impl;

import com.budgetbuddy.transaction.aspect.RequireOwnership;
import com.budgetbuddy.transaction.dto.CreateTransactionRequest;
import com.budgetbuddy.transaction.dto.TransactionResponse;
import com.budgetbuddy.transaction.dto.UpdateTransactionRequest;
import com.budgetbuddy.transaction.entity.Transaction;
import com.budgetbuddy.transaction.exception.TransactionNotFoundException;
import com.budgetbuddy.transaction.messaging.TransactionEventPublisher;
import com.budgetbuddy.transaction.repository.TransactionRepository;
import com.budgetbuddy.transaction.service.ExchangeRateService;
import com.budgetbuddy.transaction.service.ITransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionServiceImpl implements ITransactionService {

    private final TransactionRepository transactionRepository;
    private final ExchangeRateService exchangeRateService;
    private final TransactionEventPublisher eventPublisher;

    @Override
    @Transactional
    public TransactionResponse create(UUID userId, CreateTransactionRequest request) {
        Transaction transaction = Transaction.builder()
                .userId(userId)
                .description(request.description())
                .amount(request.amount())
                .type(request.type())
                .icon(request.icon())
                .category(request.category())
                .date(request.date())
                .observation(request.observation())
                .currency(request.currency() != null ? request.currency() : "ARS")
                .exchangeRateType(request.exchangeRateType())
                .account(request.account() != null ? request.account() : "Efectivo")
                .recurringFrequency(request.recurringFrequency())
                .isRecurring(request.isRecurring())
                .build();

        if (request.amountUsd() != null) {
            transaction.setAmountUsd(request.amountUsd());
        }
        if (request.txRate() != null) {
            transaction.setTxRate(request.txRate());
        }
        if (transaction.getAmountUsd() == null && "ARS".equalsIgnoreCase(transaction.getCurrency()) && request.exchangeRateType() != null) {
            try {
                transaction.setTxRate(exchangeRateService.getSellRate(request.exchangeRateType()));
                transaction.setAmountUsd(exchangeRateService.convertArsToUsd(
                        request.amount(), request.exchangeRateType()));
            } catch (Exception e) {
                log.warn("No se pudo obtener cotización de DolarAPI (amountUsd y txRate quedan null): {}", e.getMessage());
            }
        }

        Transaction saved = transactionRepository.save(transaction);
        eventPublisher.publishTransactionCreated(saved);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    @RequireOwnership
    public TransactionResponse getById(UUID userId, UUID transactionId) {
        return toResponse(transactionRepository.findById(transactionId)
                .orElseThrow(() -> new TransactionNotFoundException(transactionId)));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TransactionResponse> list(UUID userId, LocalDate from, LocalDate to, Pageable pageable) {
        Page<Transaction> page;
        if (from != null && to != null) {
            page = transactionRepository.findByUserIdAndDateBetween(userId, from, to, pageable);
        } else if (from != null) {
            page = transactionRepository.findByUserIdAndDateGreaterThanEqual(userId, from, pageable);
        } else if (to != null) {
            page = transactionRepository.findByUserIdAndDateLessThanEqual(userId, to, pageable);
        } else {
            page = transactionRepository.findByUserId(userId, pageable);
        }
        return page.map(this::toResponse);
    }

    @Override
    @Transactional
    @RequireOwnership
    public TransactionResponse update(UUID userId, UUID transactionId, UpdateTransactionRequest request) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new TransactionNotFoundException(transactionId));

        if (request.description() != null)        transaction.setDescription(request.description());
        if (request.amount() != null)              transaction.setAmount(request.amount());
        if (request.type() != null)                transaction.setType(request.type());
        if (request.icon() != null)                transaction.setIcon(request.icon());
        if (request.category() != null)            transaction.setCategory(request.category());
        if (request.date() != null)                transaction.setDate(request.date());
        if (request.observation() != null)         transaction.setObservation(request.observation());
        if (request.currency() != null)            transaction.setCurrency(request.currency());
        if (request.account() != null)             transaction.setAccount(request.account());
        if (request.recurringFrequency() != null)  transaction.setRecurringFrequency(request.recurringFrequency());
        if (request.isRecurring() != null)         transaction.setRecurring(request.isRecurring());

        if (request.exchangeRateType() != null) {
            transaction.setExchangeRateType(request.exchangeRateType());
            if ("ARS".equalsIgnoreCase(transaction.getCurrency())) {
                transaction.setTxRate(exchangeRateService.getSellRate(request.exchangeRateType()));
                transaction.setAmountUsd(exchangeRateService.convertArsToUsd(
                        transaction.getAmount(), request.exchangeRateType()));
            }
        }

        Transaction saved = transactionRepository.save(transaction);
        log.info("Transacción actualizada: id={}, userId={}", transactionId, userId);
        return toResponse(saved);
    }

    @Override
    @Transactional
    @RequireOwnership
    public void delete(UUID userId, UUID transactionId) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new TransactionNotFoundException(transactionId));
        transactionRepository.delete(transaction);
        log.info("Transacción eliminada: id={}, userId={}", transactionId, userId);
    }

    @Override
    @Transactional
    public void deleteAllByUser(UUID userId) {
        transactionRepository.deleteAllByUserId(userId);
        log.info("Todas las transacciones eliminadas para userId={}", userId);
    }

    private TransactionResponse toResponse(Transaction t) {
        return new TransactionResponse(
                t.getId(),
                t.getUserId(),
                t.getDescription(),
                t.getAmount(),
                t.getType(),
                t.getIcon(),
                t.getCategory(),
                t.getDate(),
                t.getObservation(),
                t.getCurrency(),
                t.getAmountUsd(),
                t.getTxRate(),
                t.getExchangeRateType(),
                t.getReceiptUrl(),
                t.getAccount(),
                t.getRecurringFrequency(),
                t.isRecurring(),
                t.getCreatedAt(),
                t.getUpdatedAt()
        );
    }
}
