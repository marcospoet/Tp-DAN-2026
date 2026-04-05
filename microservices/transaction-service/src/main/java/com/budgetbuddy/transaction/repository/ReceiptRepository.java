package com.budgetbuddy.transaction.repository;

import com.budgetbuddy.transaction.entity.Receipt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ReceiptRepository extends JpaRepository<Receipt, UUID> {

    Optional<Receipt> findByTransactionId(UUID transactionId);
}
