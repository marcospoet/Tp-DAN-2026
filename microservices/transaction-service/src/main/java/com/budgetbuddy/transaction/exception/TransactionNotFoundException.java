package com.budgetbuddy.transaction.exception;

import java.util.UUID;

public class TransactionNotFoundException extends RuntimeException {
    public TransactionNotFoundException(UUID id) {
        super("Transacción no encontrada: " + id);
    }
}
