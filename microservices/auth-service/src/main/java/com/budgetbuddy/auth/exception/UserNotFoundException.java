package com.budgetbuddy.auth.exception;

public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String identifier) {
        super("Usuario no encontrado: " + identifier);
    }
}
