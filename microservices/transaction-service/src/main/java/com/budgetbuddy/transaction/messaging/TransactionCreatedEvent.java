package com.budgetbuddy.transaction.messaging;

import com.budgetbuddy.transaction.entity.Transaction;

public record TransactionCreatedEvent(Transaction transaction) {}
