package com.pesito.transaction.dto;

import java.time.Instant;
import java.util.UUID;

public record ReceiptResponse(UUID id, UUID transactionId, String url, Instant uploadedAt) {}
