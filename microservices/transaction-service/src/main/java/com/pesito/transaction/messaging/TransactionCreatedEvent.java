package com.pesito.transaction.messaging;

import com.pesito.transaction.entity.Transaction;

public record TransactionCreatedEvent(Transaction transaction) {}
