package com.pesito.auth.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Slf4j
public class LoggingAspect {

    @Pointcut("within(com.pesito.auth.controller.*)")
    public void controllerMethods() {}

    @Pointcut("within(com.pesito.auth.service.impl.*)")
    public void serviceMethods() {}

    @Around("controllerMethods()")
    public Object logRequest(ProceedingJoinPoint pjp) throws Throwable {
        String method = pjp.getSignature().toShortString();
        long start = System.currentTimeMillis();
        log.info("[REQUEST ] {}", method);
        try {
            Object result = pjp.proceed();
            log.info("[RESPONSE] {} — {}ms", method, System.currentTimeMillis() - start);
            return result;
        } catch (Exception ex) {
            log.warn("[ERROR   ] {} — {} ({}ms)", method, ex.getMessage(), System.currentTimeMillis() - start);
            throw ex;
        }
    }

    @AfterThrowing(pointcut = "serviceMethods()", throwing = "ex")
    public void logServiceException(JoinPoint joinPoint, Throwable ex) {
        log.error("[EXCEPTION] {} — {}: {}",
                joinPoint.getSignature().toShortString(),
                ex.getClass().getSimpleName(),
                ex.getMessage());
    }
}
