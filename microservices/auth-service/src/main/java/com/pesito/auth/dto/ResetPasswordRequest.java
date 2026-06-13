package com.pesito.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ResetPasswordRequest(

    @NotBlank(message = "El email es obligatorio.")
    @Email(message = "El email no tiene un formato válido.")
    String email,

    @NotBlank(message = "El código es obligatorio.")
    @Pattern(regexp = "\\d{6}", message = "El código debe tener 6 dígitos.")
    String code,

    @NotBlank(message = "La nueva contraseña es obligatoria.")
    String newPassword
) {}
