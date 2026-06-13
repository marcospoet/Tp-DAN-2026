package com.pesito.auth.controller;

import com.pesito.auth.dto.*;
import com.pesito.auth.service.IAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Registro, login, validación de tokens y gestión de perfil")
public class AuthController {

    private final IAuthService authService;

    @Operation(summary = "Registrar nuevo usuario", description = "Crea el usuario y su perfil, devuelve un JWT listo para usar")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Usuario creado exitosamente"),
        @ApiResponse(responseCode = "400", description = "Email ya registrado o datos inválidos")
    })
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @Operation(summary = "Login con email y password", description = "Devuelve un JWT si las credenciales son válidas")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Login exitoso"),
        @ApiResponse(responseCode = "401", description = "Credenciales incorrectas")
    })
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @Operation(summary = "Validar token JWT", description = "Usado internamente por el API Gateway para verificar tokens entrantes")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Token válido"),
        @ApiResponse(responseCode = "401", description = "Token inválido o expirado")
    })
    @GetMapping("/validate")
    public ResponseEntity<ValidateResponse> validate(
        @RequestHeader("Authorization") String authHeader
    ) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ValidateResponse(null, null, false));
        }
        ValidateResponse response = authService.validate(authHeader.substring(7));
        if (!response.valid()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Verificar email con código", description = "El usuario ingresa el código de 6 dígitos que recibió por email al registrarse")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Email verificado exitosamente"),
        @ApiResponse(responseCode = "400", description = "Código inválido o expirado")
    })
    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        try {
            authService.verifyEmail(request.email(), request.code());
            return ResponseEntity.ok(Map.of("message", "Email verificado exitosamente."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Reenviar email de verificación")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Email reenviado"),
        @ApiResponse(responseCode = "400", description = "El email ya está verificado")
    })
    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(@AuthenticationPrincipal UserDetails user) {
        authService.resendVerification(user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Solicitar restablecimiento de contraseña", description = "Si el email corresponde a una cuenta local, envía un código de 6 dígitos para restablecer la contraseña")
    @ApiResponse(responseCode = "204", description = "Solicitud procesada (siempre, exista o no la cuenta)")
    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request.email());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Restablecer contraseña con código", description = "El usuario ingresa el código de 6 dígitos recibido por email junto con la nueva contraseña")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Contraseña restablecida exitosamente"),
        @ApiResponse(responseCode = "400", description = "Código inválido o expirado, o contraseña inválida")
    })
    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Obtener perfil del usuario autenticado")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/profile")
    public ResponseEntity<ProfileResponse> getProfile(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(authService.getProfile(user.getUsername()));
    }

    @Operation(summary = "Actualizar perfil del usuario autenticado")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/profile")
    public ResponseEntity<ProfileResponse> updateProfile(
        @AuthenticationPrincipal UserDetails user,
        @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(authService.updateProfile(user.getUsername(), request));
    }

    @Operation(summary = "Cambiar contraseña del usuario autenticado")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Contraseña actualizada"),
        @ApiResponse(responseCode = "400", description = "Contraseña actual incorrecta o nueva contraseña muy corta")
    })
    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(
        @AuthenticationPrincipal UserDetails user,
        @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(user.getUsername(), request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Eliminar cuenta del usuario autenticado", description = "Borra usuario y perfil, y publica evento user.deleted en RabbitMQ")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponse(responseCode = "204", description = "Usuario eliminado")
    @DeleteMapping("/profile")
    public ResponseEntity<Void> deleteUser(@AuthenticationPrincipal UserDetails user) {
        authService.deleteUser(user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
