package com.pesito.auth.dto;

public record ChangePasswordRequest(String currentPassword, String newPassword) {}
