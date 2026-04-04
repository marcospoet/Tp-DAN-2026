package com.budgetbuddy.auth.service;

import com.budgetbuddy.auth.dto.*;

public interface IAuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    ValidateResponse validate(String token);
    ProfileResponse getProfile(String email);
    ProfileResponse updateProfile(String email, UpdateProfileRequest request);
    void deleteUser(String email);
}
