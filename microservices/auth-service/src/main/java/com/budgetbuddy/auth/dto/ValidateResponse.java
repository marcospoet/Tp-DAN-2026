package com.budgetbuddy.auth.dto;

import java.util.UUID;

public record ValidateResponse(UUID userId, String email, boolean valid) {}
