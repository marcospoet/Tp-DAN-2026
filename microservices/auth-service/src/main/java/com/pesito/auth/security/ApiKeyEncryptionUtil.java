package com.pesito.auth.security;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Cifrado AES-256-GCM para API keys almacenadas en base de datos.
 *
 * El JPA AttributeConverter (EncryptedStringConverter) llama a los métodos
 * estáticos de esta clase. El secreto se inyecta via Spring en el @PostConstruct
 * y queda disponible como campo estático antes de que Hibernate ejecute cualquier
 * operacion de persistencia.
 *
 * Formato almacenado en DB: Base64( IV[12 bytes] || ciphertext+authTag )
 */
@Component
public class ApiKeyEncryptionUtil {

    private static final int IV_LENGTH_BYTES = 12;   // GCM standard
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    // Salt fijo es aceptable aquí: solo se usa para derivar la clave desde el secreto,
    // no para almacenar contraseñas de usuario.
    private static final byte[] PBKDF2_SALT = "pesito-key-salt-2026".getBytes(StandardCharsets.UTF_8);
    private static final int PBKDF2_ITERATIONS = 65536;

    private static SecretKey SECRET_KEY;

    @Value("${app.encryption.secret}")
    private String secret;

    @PostConstruct
    void init() throws Exception {
        SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        KeySpec spec = new PBEKeySpec(secret.toCharArray(), PBKDF2_SALT, PBKDF2_ITERATIONS, 256);
        SECRET_KEY = new SecretKeySpec(factory.generateSecret(spec).getEncoded(), "AES");
    }

    public static String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) return null;
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, SECRET_KEY, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            // Almacenar: IV || ciphertext (ciphertext ya incluye el authTag al final)
            byte[] combined = new byte[IV_LENGTH_BYTES + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH_BYTES);
            System.arraycopy(ciphertext, 0, combined, IV_LENGTH_BYTES, ciphertext.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("Error al cifrar API key", e);
        }
    }

    public static String decrypt(String encoded) {
        // Strings vacíos pueden existir en filas anteriores al cifrado (legacy) — tratar como ausencia de key.
        if (encoded == null || encoded.isBlank()) return null;
        try {
            byte[] combined = Base64.getDecoder().decode(encoded);
            byte[] iv = Arrays.copyOfRange(combined, 0, IV_LENGTH_BYTES);
            byte[] ciphertext = Arrays.copyOfRange(combined, IV_LENGTH_BYTES, combined.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, SECRET_KEY, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));

            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Error al descifrar API key", e);
        }
    }
}
