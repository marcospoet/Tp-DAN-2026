package com.pesito.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Límites de rate limiting del gateway, configurables vía application.properties
 * (prefijo {@code rate-limit}). Tres tiers:
 * <ul>
 *   <li><b>ai</b>: rutas /api/ai/** — bajo, porque cada llamada cuesta tokens. Por usuario.</li>
 *   <li><b>auth</b>: login/register/recupero/verificación — anti fuerza bruta. Por IP.</li>
 *   <li><b>defaults</b>: resto de la API autenticada. Por usuario.</li>
 * </ul>
 */
@Component
@ConfigurationProperties(prefix = "rate-limit")
public class RateLimitProperties {

    /** Permite apagar todo el rate limiting (ej. en tests). */
    private boolean enabled = true;

    private Tier ai = new Tier(20, Duration.ofMinutes(1));
    private Tier auth = new Tier(10, Duration.ofMinutes(1));
    private Tier defaults = new Tier(100, Duration.ofMinutes(1));

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public Tier getAi() { return ai; }
    public void setAi(Tier ai) { this.ai = ai; }

    public Tier getAuth() { return auth; }
    public void setAuth(Tier auth) { this.auth = auth; }

    public Tier getDefaults() { return defaults; }
    public void setDefaults(Tier defaults) { this.defaults = defaults; }

    /** Un tier = capacidad del bucket que se rellena por completo cada {@code refillPeriod}. */
    public static class Tier {
        private int capacity;
        private Duration refillPeriod;

        public Tier() {}

        public Tier(int capacity, Duration refillPeriod) {
            this.capacity = capacity;
            this.refillPeriod = refillPeriod;
        }

        public int getCapacity() { return capacity; }
        public void setCapacity(int capacity) { this.capacity = capacity; }

        public Duration getRefillPeriod() { return refillPeriod; }
        public void setRefillPeriod(Duration refillPeriod) { this.refillPeriod = refillPeriod; }
    }
}
