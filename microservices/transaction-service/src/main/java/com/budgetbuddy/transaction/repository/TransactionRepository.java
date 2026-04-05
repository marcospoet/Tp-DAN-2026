package com.budgetbuddy.transaction.repository;

import com.budgetbuddy.transaction.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    Page<Transaction> findByUserId(UUID userId, Pageable pageable);

    Page<Transaction> findByUserIdAndDateBetween(UUID userId, LocalDate from, LocalDate to, Pageable pageable);

    void deleteAllByUserId(UUID userId);
}

