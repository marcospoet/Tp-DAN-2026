package com.pesito.gateway.filter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.pesito.gateway.config.RateLimitProperties;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.Refill;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.support.ipresolver.XForwardedRemoteAddressResolver;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;

/**
 * Rate limiting per-usuario / per-IP en el borde, con token bucket (Bucket4j) en memoria.
 *
 * <p>Complementa al CircuitBreaker (que reacciona a fallos del downstream): este filtro
 * frena el VOLUMEN de un cliente para proteger el costo de IA (tokens) y el login de
 * fuerza bruta. Corre con orden -90, es decir DESPUÉS del {@link JwtAuthenticationFilter}
 * (-100), para que {@code X-User-Id} ya esté disponible en las rutas autenticadas.
 *
 * <p>Caveat de escalado: los buckets son por instancia. Con {@code replicas: 1} el límite
 * es exacto; si se escala el gateway horizontalmente (HPA), el límite efectivo se multiplica
 * por la cantidad de réplicas. Para protección anti-abuso es aceptable; si se necesitara
 * exactitud distribuida, migrar el backend de Bucket4j a Redis/Hazelcast.
 */
@Component
public class RateLimitingFilter implements GlobalFilter, Ordered {

    /** Rutas sin límite (health, métricas, fallbacks del circuit breaker). */
    private static final List<String> EXEMPT = List.of("/actuator", "/fallback");

    /** Endpoints públicos sensibles a fuerza bruta — se limitan por IP (no hay usuario aún). */
    private static final List<String> AUTH_SENSITIVE = List.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/api/auth/verify-email"
    );

    private final RateLimitProperties props;
    private final MeterRegistry meterRegistry;

    /** Un bucket por clave (tier:usuario o tier:ip). Caffeine expira los inactivos. */
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10))
            .maximumSize(100_000)
            .build();

    /** Resuelve la IP real detrás de Traefik/ingress vía X-Forwarded-For (confía 1 proxy). */
    private final XForwardedRemoteAddressResolver ipResolver =
            XForwardedRemoteAddressResolver.maxTrustedIndex(1);

    public RateLimitingFilter(RateLimitProperties props, MeterRegistry meterRegistry) {
        this.props = props;
        this.meterRegistry = meterRegistry;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (!props.isEnabled()) {
            return chain.filter(exchange);
        }

        String path = exchange.getRequest().getURI().getPath();
        if (EXEMPT.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange);
        }

        RateLimitProperties.Tier tier;
        String tierName;
        String key;
        if (path.startsWith("/api/ai/")) {
            tier = props.getAi();
            tierName = "ai";
            key = userKey(exchange);
        } else if (AUTH_SENSITIVE.stream().anyMatch(path::startsWith)) {
            tier = props.getAuth();
            tierName = "auth";
            key = ipKey(exchange);
        } else {
            tier = props.getDefaults();
            tierName = "default";
            key = userKey(exchange);
        }

        Bucket bucket = buckets.get(tierName + ":" + key, k -> newBucket(tier));
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        if (probe.isConsumed()) {
            exchange.getResponse().getHeaders()
                    .add("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            return chain.filter(exchange);
        }

        long retryAfterSec = Math.max(1, probe.getNanosToWaitForRefill() / 1_000_000_000L);
        meterRegistry.counter("gateway.rate_limit.rejected", "tier", tierName).increment();
        exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        exchange.getResponse().getHeaders().add("Retry-After", String.valueOf(retryAfterSec));
        return exchange.getResponse().setComplete();
    }

    private Bucket newBucket(RateLimitProperties.Tier tier) {
        Bandwidth limit = Bandwidth.classic(
                tier.getCapacity(),
                Refill.greedy(tier.getCapacity(), tier.getRefillPeriod()));
        return Bucket.builder().addLimit(limit).build();
    }

    /** Clave por usuario (X-User-Id que setea el JWT filter); cae a IP si no hay usuario. */
    private String userKey(ServerWebExchange exchange) {
        String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
        return userId != null ? "u:" + userId : ipKey(exchange);
    }

    private String ipKey(ServerWebExchange exchange) {
        InetSocketAddress addr = ipResolver.resolve(exchange);
        if (addr != null && addr.getAddress() != null) {
            return "ip:" + addr.getAddress().getHostAddress();
        }
        InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
        if (remote != null && remote.getAddress() != null) {
            return "ip:" + remote.getAddress().getHostAddress();
        }
        return "ip:unknown";
    }

    @Override
    public int getOrder() {
        return -90; // después del JwtAuthenticationFilter (-100)
    }
}
