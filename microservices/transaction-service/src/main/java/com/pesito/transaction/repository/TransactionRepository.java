package com.pesito.transaction.repository;

import com.pesito.transaction.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    Page<Transaction> findByUserId(UUID userId, Pageable pageable);

    Page<Transaction> findByUserIdAndDateBetween(UUID userId, LocalDate from, LocalDate to, Pageable pageable);

    Page<Transaction> findByUserIdAndDateGreaterThanEqual(UUID userId, LocalDate from, Pageable pageable);

    Page<Transaction> findByUserIdAndDateLessThanEqual(UUID userId, LocalDate to, Pageable pageable);

    void deleteAllByUserId(UUID userId);
}

