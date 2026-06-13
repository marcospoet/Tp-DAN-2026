package com.pesito.auth.service;

import com.pesito.auth.dto.*;

public interface IAuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    ValidateResponse validate(String token);
    ProfileResponse getProfile(String email);
    ProfileResponse updateProfile(String email, UpdateProfileRequest request);
    void changePassword(String email, ChangePasswordRequest request);
    void deleteUser(String email);
    void verifyEmail(String email, String code);
    void resendVerification(String email);
    void forgotPassword(String email);
    void resetPassword(ResetPasswordRequest request);
}
