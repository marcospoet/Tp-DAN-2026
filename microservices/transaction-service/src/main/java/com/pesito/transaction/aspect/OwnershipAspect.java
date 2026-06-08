package com.pesito.transaction.aspect;

import com.pesito.transaction.entity.Transaction;
import com.pesito.transaction.exception.AccessDeniedException;
import com.pesito.transaction.exception.TransactionNotFoundException;
import com.pesito.transaction.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class OwnershipAspect {

    private final TransactionRepository transactionRepository;

    @Before("@annotation(com.pesito.transaction.aspect.RequireOwnership)")
    public void validateOwnership(JoinPoint joinPoint) {
        Object[] args = joinPoint.getArgs();
        UUID userId = (UUID) args[0];
        UUID transactionId = (UUID) args[1];

        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new TransactionNotFoundException(transactionId));

        if (!transaction.getUserId().equals(userId)) {
            log.warn("[OWNERSHIP] Acceso denegado: userId={} intentó acceder a transactionId={}", userId, transactionId);
            throw new AccessDeniedException();
        }
    }
}
