package com.pesito.auth.service.impl;

import com.pesito.auth.dto.*;
import com.pesito.auth.exception.EmailAlreadyRegisteredException;
import com.pesito.auth.exception.UserNotFoundException;
import org.springframework.security.authentication.BadCredentialsException;
import com.pesito.auth.entity.Profile;
import com.pesito.auth.entity.User;
import org.springframework.context.ApplicationEventPublisher;
import com.pesito.auth.repository.UserRepository;
import com.pesito.auth.security.JwtUtil;
import com.pesito.auth.service.IAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pesito.auth.messaging.UserDeletedEvent;
import com.pesito.auth.messaging.UserRegisteredEvent;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements IAuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyRegisteredException(request.email());
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

        eventPublisher.publishEvent(new UserRegisteredEvent(user.getId(), user.getEmail()));

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
            .orElseThrow(() -> new UserNotFoundException(email));
        Profile p = user.getProfile();
        return toProfileResponse(user, p);
    }

    @Override
    @Transactional
    public ProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UserNotFoundException(email));
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
        if (request.defaultAccount() != null)   p.setDefaultAccount(request.defaultAccount());

        return toProfileResponse(user, p);
    }

    private static final String PASSWORD_REGEX = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$";
    private static final String PASSWORD_REQUIREMENTS =
        "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.";

    @Override
    @Transactional
    public void changePassword(String email, ChangePasswordRequest request) {
        if (request.newPassword() == null || !request.newPassword().matches(PASSWORD_REGEX)) {
            throw new IllegalArgumentException(PASSWORD_REQUIREMENTS);
        }
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UserNotFoundException(email));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("La contraseña actual es incorrecta.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void deleteUser(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UserNotFoundException(email));
        UUID userId = user.getId();
        userRepository.delete(user);
        eventPublisher.publishEvent(new UserDeletedEvent(userId, email));
    }

    private ProfileResponse toProfileResponse(User user, Profile p) {
        return new ProfileResponse(
            user.getId(), user.getEmail(),
            p.getUserName(), p.getMonthlyBudget(),
            p.getProfileMode(), p.getExchangeRateMode(),
            p.getUsdRate(), p.getAiProvider(),
            p.getApiKeyClaude(), p.getApiKeyOpenai(), p.getApiKeyGemini(),
            p.getDefaultAccount()
        );
    }
}
