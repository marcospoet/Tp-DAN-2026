package com.budgetbuddy.auth.dto;

public record ChangePasswordRequest(String currentPassword, String newPassword) {}
