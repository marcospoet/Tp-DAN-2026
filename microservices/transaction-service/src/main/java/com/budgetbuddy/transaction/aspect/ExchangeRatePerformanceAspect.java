package com.budgetbuddy.transaction.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Slf4j
public class ExchangeRatePerformanceAspect {

    private static final long SLOW_CALL_THRESHOLD_MS = 3_000;

    @Around("execution(public * com.budgetbuddy.transaction.service.ExchangeRateService.*(..))")
    public Object measureExternalCall(ProceedingJoinPoint pjp) throws Throwable {
        String method = pjp.getSignature().getName();
        long start = System.currentTimeMillis();
        try {
            Object result = pjp.proceed();
            long elapsed = System.currentTimeMillis() - start;
            if (elapsed > SLOW_CALL_THRESHOLD_MS) {
                log.warn("[PERF] DolarAPI {}() — {}ms (lento)", method, elapsed);
            } else {
                log.debug("[PERF] DolarAPI {}() — {}ms", method, elapsed);
            }
            return result;
        } catch (Exception ex) {
            log.error("[PERF] DolarAPI {}() falló en {}ms: {}", method, System.currentTimeMillis() - start, ex.getMessage());
            throw ex;
        }
    }
}
