package com.budgetbuddy.transaction.exception;

public class MinioException extends RuntimeException {
    public MinioException(String message, Throwable cause) {
        super(message, cause);
    }
}
