package com.budgetbuddy.auth.controller;

import com.budgetbuddy.auth.dto.*;
import com.budgetbuddy.auth.service.IAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
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

    @Operation(summary = "Eliminar cuenta del usuario autenticado", description = "Borra usuario y perfil, y publica evento user.deleted en RabbitMQ")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponse(responseCode = "204", description = "Usuario eliminado")
    @DeleteMapping("/profile")
    public ResponseEntity<Void> deleteUser(@AuthenticationPrincipal UserDetails user) {
        authService.deleteUser(user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
