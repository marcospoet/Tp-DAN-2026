package com.budgetbuddy.auth.service.impl;

import com.budgetbuddy.auth.dto.*;
import com.budgetbuddy.auth.entity.Profile;
import com.budgetbuddy.auth.entity.User;
import com.budgetbuddy.auth.messaging.UserEventPublisher;
import com.budgetbuddy.auth.repository.UserRepository;
import com.budgetbuddy.auth.security.JwtUtil;
import com.budgetbuddy.auth.service.IAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements IAuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final UserEventPublisher eventPublisher;

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already registered: " + request.email());
        }

        User user = User.builder()
            .email(request.email())
            .passwordHash(passwordEncoder.encode(request.password()))
            .provider("local")
            .build();

        Profile profile = Profile.builder()
            .user(user)
            .userName(request.userName() != null ? request.userName() : "Usuario")
            .build();

        user.setProfile(profile);
        userRepository.save(user);

        eventPublisher.publishUserRegistered(user.getId(), user.getEmail());

        String token = jwtUtil.generateToken(user.getEmail(), user.getId());
        return new AuthResponse(token, user.getId(), user.getEmail());
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        User user = userRepository.findByEmail(request.email()).orElseThrow();

        String token = jwtUtil.generateToken(user.getEmail(), user.getId());
        return new AuthResponse(token, user.getId(), user.getEmail());
    }

    @Override
    public ValidateResponse validate(String token) {
        if (!jwtUtil.isTokenValid(token)) {
            return new ValidateResponse(null, null, false);
        }
        String email = jwtUtil.extractEmail(token);
        String userId = jwtUtil.extractUserId(token);
        return new ValidateResponse(UUID.fromString(userId), email, true);
    }

    @Override
    @Transactional(readOnly = true)
    public ProfileResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Profile p = user.getProfile();
        return new ProfileResponse(
            user.getId(), user.getEmail(),
            p.getUserName(), p.getMonthlyBudget(),
            p.getProfileMode(), p.getExchangeRateMode(),
            p.getUsdRate(), p.getAiProvider()
        );
    }

    @Override
    @Transactional
    public ProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Profile p = user.getProfile();

        if (request.userName() != null)         p.setUserName(request.userName());
        if (request.monthlyBudget() != null)    p.setMonthlyBudget(request.monthlyBudget());
        if (request.profileMode() != null)      p.setProfileMode(request.profileMode());
        if (request.exchangeRateMode() != null) p.setExchangeRateMode(request.exchangeRateMode());
        if (request.usdRate() != null)          p.setUsdRate(request.usdRate());
        if (request.aiProvider() != null)       p.setAiProvider(request.aiProvider());
        if (request.apiKeyClaude() != null)     p.setApiKeyClaude(request.apiKeyClaude());
        if (request.apiKeyOpenai() != null)     p.setApiKeyOpenai(request.apiKeyOpenai());
        if (request.apiKeyGemini() != null)     p.setApiKeyGemini(request.apiKeyGemini());

        return new ProfileResponse(
            user.getId(), user.getEmail(),
            p.getUserName(), p.getMonthlyBudget(),
            p.getProfileMode(), p.getExchangeRateMode(),
            p.getUsdRate(), p.getAiProvider()
        );
    }

    @Override
    @Transactional
    public void deleteUser(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        UUID userId = user.getId();
        userRepository.delete(user);
        eventPublisher.publishUserDeleted(userId, email);
    }
}
