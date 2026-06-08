package com.pesito.transaction.aspect;

import com.pesito.transaction.dto.TransactionResponse;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Aspect
@Component
@Slf4j
public class AuditAspect {

    @Pointcut("execution(* com.pesito.transaction.service.impl.TransactionServiceImpl.create(..))")
    public void createTransaction() {}

    @Pointcut("execution(* com.pesito.transaction.service.impl.TransactionServiceImpl.update(..))")
    public void updateTransaction() {}

    @Pointcut("execution(* com.pesito.transaction.service.impl.TransactionServiceImpl.delete(..))")
    public void deleteTransaction() {}

    @AfterReturning(pointcut = "createTransaction()", returning = "result")
    public void auditCreate(JoinPoint joinPoint, Object result) {
        UUID userId = (UUID) joinPoint.getArgs()[0];
        if (result instanceof TransactionResponse tx) {
            log.info("[AUDIT] CREATE — userId={}, transactionId={}, amount={} {}",
                    userId, tx.id(), tx.amount(), tx.currency());
        }
    }

    @AfterReturning(pointcut = "updateTransaction()", returning = "result")
    public void auditUpdate(JoinPoint joinPoint, Object result) {
        UUID userId = (UUID) joinPoint.getArgs()[0];
        UUID transactionId = (UUID) joinPoint.getArgs()[1];
        log.info("[AUDIT] UPDATE — userId={}, transactionId={}", userId, transactionId);
    }

    @AfterReturning("deleteTransaction()")
    public void auditDelete(JoinPoint joinPoint) {
        UUID userId = (UUID) joinPoint.getArgs()[0];
        UUID transactionId = (UUID) joinPoint.getArgs()[1];
        log.info("[AUDIT] DELETE — userId={}, transactionId={}", userId, transactionId);
    }
}
