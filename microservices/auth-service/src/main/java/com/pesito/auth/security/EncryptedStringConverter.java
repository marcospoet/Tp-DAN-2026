package com.pesito.auth.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA AttributeConverter que cifra/descifra transparentemente los campos
 * anotados con @Convert(converter = EncryptedStringConverter.class).
 *
 * Hibernate llama a convertToDatabaseColumn() al hacer INSERT/UPDATE
 * y a convertToEntityAttribute() al hacer SELECT.
 * El cifrado real lo delega a ApiKeyEncryptionUtil (inicializado por Spring).
 */
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return ApiKeyEncryptionUtil.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return ApiKeyEncryptionUtil.decrypt(dbData);
    }
}
