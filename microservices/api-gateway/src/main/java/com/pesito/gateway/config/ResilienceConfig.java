package com.pesito.gateway.config;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.timelimiter.TimeLimiterConfig;
import org.springframework.cloud.circuitbreaker.resilience4j.ReactiveResilience4JCircuitBreakerFactory;
import org.springframework.cloud.circuitbreaker.resilience4j.Resilience4JConfigBuilder;
import org.springframework.cloud.client.circuitbreaker.Customizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class ResilienceConfig {

    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> globalConfig() {
        TimeLimiterConfig timeLimiter = TimeLimiterConfig.custom()
                .timeoutDuration(Duration.ofSeconds(5))
                .build();

        CircuitBreakerConfig cbConfig = CircuitBreakerConfig.custom()
                .failureRateThreshold(50)
                .slowCallRateThreshold(80)
                .slowCallDurationThreshold(Duration.ofSeconds(3))
                .slidingWindowSize(10)
                .minimumNumberOfCalls(5)
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .permittedNumberOfCallsInHalfOpenState(3)
                .automaticTransitionFromOpenToHalfOpenEnabled(true)
                .build();

        return factory -> factory.configureDefault(id ->
                new Resilience4JConfigBuilder(id)
                        .timeLimiterConfig(timeLimiter)
                        .circuitBreakerConfig(cbConfig)
                        .build()
        );
    }

    // auth-service: toca DB + RabbitMQ + BCrypt → timeout suficiente para registro
    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> authServiceConfig() {
        TimeLimiterConfig timeLimiter = TimeLimiterConfig.custom()
                .timeoutDuration(Duration.ofSeconds(8))
                .build();

        CircuitBreakerConfig cbConfig = CircuitBreakerConfig.custom()
                .failureRateThreshold(40)
                .slowCallDurationThreshold(Duration.ofSeconds(4))
                .slowCallRateThreshold(60)
                .slidingWindowSize(10)
                .minimumNumberOfCalls(5)
                .waitDurationInOpenState(Duration.ofSeconds(8))
                .permittedNumberOfCallsInHalfOpenState(2)
                .automaticTransitionFromOpenToHalfOpenEnabled(true)
                .build();

        return factory -> factory.configure(builder ->
                builder.timeLimiterConfig(timeLimiter)
                       .circuitBreakerConfig(cbConfig)
                       .build(),
                "auth-service"
        );
    }

    // transaction-service: llama a DolarAPI externa → más margen de tiempo
    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> transactionServiceConfig() {
        TimeLimiterConfig timeLimiter = TimeLimiterConfig.custom()
                .timeoutDuration(Duration.ofSeconds(8))
                .build();

        CircuitBreakerConfig cbConfig = CircuitBreakerConfig.custom()
                .failureRateThreshold(50)
                .slowCallDurationThreshold(Duration.ofSeconds(5))
                .slowCallRateThreshold(70)
                .slidingWindowSize(10)
                .minimumNumberOfCalls(5)
                .waitDurationInOpenState(Duration.ofSeconds(15))
                .permittedNumberOfCallsInHalfOpenState(3)
                .automaticTransitionFromOpenToHalfOpenEnabled(true)
                .build();

        return factory -> factory.configure(builder ->
                builder.timeLimiterConfig(timeLimiter)
                       .circuitBreakerConfig(cbConfig)
                       .build(),
                "transaction-service"
        );
    }

    // ai-service: experimental, APIs de IA son lentas por naturaleza
    @Bean
    public Customizer<ReactiveResilience4JCircuitBreakerFactory> aiServiceConfig() {
        TimeLimiterConfig timeLimiter = TimeLimiterConfig.custom()
                .timeoutDuration(Duration.ofSeconds(30))
                .build();

        CircuitBreakerConfig cbConfig = CircuitBreakerConfig.custom()
                .failureRateThreshold(60)
                .slowCallDurationThreshold(Duration.ofSeconds(25))
                .slowCallRateThreshold(80)
                .slidingWindowSize(5)
                .minimumNumberOfCalls(3)
                .waitDurationInOpenState(Duration.ofSeconds(20))
                .permittedNumberOfCallsInHalfOpenState(2)
                .automaticTransitionFromOpenToHalfOpenEnabled(false)
                .build();

        return factory -> factory.configure(builder ->
                builder.timeLimiterConfig(timeLimiter)
                       .circuitBreakerConfig(cbConfig)
                       .build(),
                "ai-service"
        );
    }
}
