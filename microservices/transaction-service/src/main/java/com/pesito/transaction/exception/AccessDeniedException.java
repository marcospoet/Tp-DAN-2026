package com.pesito.transaction.exception;

public class AccessDeniedException extends RuntimeException {
    public AccessDeniedException() {
        super("No tenés acceso a esta transacción");
    }
}
