package com.pesito.auth.service.impl;

import com.pesito.auth.dto.*;
import com.pesito.auth.exception.EmailAlreadyRegisteredException;
import com.pesito.auth.exception.UserNotFoundException;
import com.pesito.auth.service.EmailVerificationService;
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
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements IAuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final ApplicationEventPublisher eventPublisher;
    private final EmailVerificationService emailVerificationService;

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyRegisteredException(request.email());
        }

        String verificationToken = UUID.randomUUID().toString();

        User user = User.builder()
            .email(request.email())
            .passwordHash(passwordEncoder.encode(request.password()))
            .provider("local")
            .emailVerified(false)
            .emailVerificationToken(verificationToken)
            .emailVerificationExpiry(Instant.now().plusSeconds(86400))
            .build();

        Profile profile = Profile.builder()
            .user(user)
            .userName(request.userName() != null ? request.userName() : "Usuario")
            .build();

        user.setProfile(profile);
        userRepository.save(user);

        eventPublisher.publishEvent(new UserRegisteredEvent(user.getId(), user.getEmail()));

        try {
            emailVerificationService.sendVerificationEmail(user.getEmail(), verificationToken);
        } catch (Exception ignored) {
            // El registro no falla si el mail no se puede enviar
        }

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
        return toProfileResponse(user);
    }

    @Override
    @Transactional
    public ProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UserNotFoundException(email));
        Profile p = user.getProfile();

        if (request.userName() != null)          p.setUserName(request.userName());
        if (request.monthlyBudget() != null)     p.setMonthlyBudget(request.monthlyBudget());
        if (request.profileMode() != null)       p.setProfileMode(request.profileMode());
        if (request.exchangeRateMode() != null)  p.setExchangeRateMode(request.exchangeRateMode());
        if (request.usdRate() != null)           p.setUsdRate(request.usdRate());
        if (request.aiProvider() != null)        p.setAiProvider(request.aiProvider());
        applyApiKey(request.apiKeyClaude(), p::getApiKeyClaude, p::setApiKeyClaude);
        applyApiKey(request.apiKeyOpenai(), p::getApiKeyOpenai, p::setApiKeyOpenai);
        applyApiKey(request.apiKeyGemini(), p::getApiKeyGemini, p::setApiKeyGemini);
        if (request.defaultAccount() != null)    p.setDefaultAccount(request.defaultAccount());
        if (request.defaultExRateType() != null) p.setDefaultExRateType(request.defaultExRateType());

        return toProfileResponse(user);
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

    @Override
    @Transactional
    public void verifyEmail(String token) {
        User user = userRepository.findByEmailVerificationToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Token de verificación inválido."));

        if (user.getEmailVerificationExpiry() == null ||
            user.getEmailVerificationExpiry().isBefore(Instant.now())) {
            throw new IllegalArgumentException("El token de verificación expiró.");
        }

        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationExpiry(null);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void resendVerification(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UserNotFoundException(email));

        if (user.isEmailVerified()) {
            throw new IllegalStateException("El email ya está verificado.");
        }

        String token = UUID.randomUUID().toString();
        user.setEmailVerificationToken(token);
        user.setEmailVerificationExpiry(Instant.now().plusSeconds(86400));
        userRepository.save(user);

        emailVerificationService.sendVerificationEmail(email, token);
    }

    private ProfileResponse toProfileResponse(User user) {
        Profile p = user.getProfile();
        return new ProfileResponse(
            user.getId(), user.getEmail(),
            p.getUserName(), p.getMonthlyBudget(),
            p.getProfileMode(), p.getExchangeRateMode(),
            p.getUsdRate(), p.getAiProvider(),
            maskApiKey(p.getApiKeyClaude()),
            maskApiKey(p.getApiKeyOpenai()),
            maskApiKey(p.getApiKeyGemini()),
            p.getDefaultAccount(), p.getDefaultExRateType(),
            user.isEmailVerified(), user.getProvider()
        );
    }

    /** Devuelve solo los primeros 4 y últimos 4 caracteres de la key. Nunca expone el valor completo. */
    private static String maskApiKey(String key) {
        if (key == null || key.isBlank()) return null;
        if (key.length() <= 8) return "****";
        return key.substring(0, 4) + "...****" + key.substring(key.length() - 4);
    }

    /**
     * Aplica un nuevo valor de API key, ignorando el caso en que el cliente reenvía
     * sin cambios el valor enmascarado que recibió de toProfileResponse (evita
     * sobrescribir la key real cifrada con su propio placeholder enmascarado).
     */
    private void applyApiKey(String incoming, java.util.function.Supplier<String> getter, java.util.function.Consumer<String> setter) {
        if (incoming == null) return;
        if (incoming.isBlank()) { setter.accept(null); return; }
        if (incoming.equals(maskApiKey(getter.get()))) return;
        setter.accept(incoming);
    }
}
