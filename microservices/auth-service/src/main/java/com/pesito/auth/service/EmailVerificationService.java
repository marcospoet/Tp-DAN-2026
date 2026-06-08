package com.pesito.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${spring.mail.from:noreply@pesito.app}")
    private String fromAddress;

    public void sendVerificationEmail(String toEmail, String token) {
        String link = frontendUrl + "?verify_token=" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject("Verificá tu email — Pesito");
        message.setText(
            "Hola!\n\n" +
            "Gracias por registrarte en Pesito. Para verificar tu email hacé clic en el siguiente enlace:\n\n" +
            link + "\n\n" +
            "El enlace expira en 24 horas.\n\n" +
            "Si no creaste esta cuenta, ignorá este email.\n\n" +
            "— El equipo de Pesito"
        );

        mailSender.send(message);
    }
}
