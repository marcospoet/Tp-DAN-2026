package com.pesito.ai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient webClient() {
        return WebClient.builder()
                .codecs(config -> config.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    /**
     * Cliente para llamar a transaction-service desde las tools del agente
     * (saldos, transacciones, resumen mensual, cotizaciones, alta de transacciones).
     */
    @Bean
    public WebClient transactionServiceWebClient(AiProperties props) {
        return WebClient.builder()
                .baseUrl(props.getTransactionServiceBaseUrl())
                .codecs(config -> config.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }
}
