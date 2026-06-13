package com.pesito.ai.config;

import io.netty.channel.ChannelOption;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
public class WebClientConfig {

    /** Timeout de establecimiento de conexión TCP — debe ser siempre rápido. */
    private static final int CONNECT_TIMEOUT_MS = 5000;

    /**
     * Construye un connector Reactor Netty con timeouts. {@code responseTimeout} es el
     * tope entre que se termina de escribir el request y se recibe la respuesta:
     * sin esto, si el remoto acepta la conexión pero nunca responde, el {@code .block()}
     * espera para siempre y bloquea el hilo (PERF-02).
     */
    private static ReactorClientHttpConnector connector(Duration responseTimeout) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MS)
                .responseTimeout(responseTimeout);
        return new ReactorClientHttpConnector(httpClient);
    }

    /**
     * Cliente para los proveedores de IA (Claude/OpenAI/Gemini): chat, visión,
     * transcripción y embeddings. Estas llamadas tardan legítimamente decenas de
     * segundos, por eso el timeout es generoso (120s): protege contra cuelgues
     * infinitos sin matar una generación larga válida.
     */
    @Bean
    public WebClient webClient() {
        return WebClient.builder()
                .clientConnector(connector(Duration.ofSeconds(120)))
                .codecs(config -> config.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    /**
     * Cliente para llamar a transaction-service desde las tools del agente
     * (saldos, transacciones, resumen mensual, cotizaciones, alta de transacciones).
     * Servicio interno y rápido: timeout corto (10s).
     */
    @Bean
    public WebClient transactionServiceWebClient(AiProperties props) {
        return WebClient.builder()
                .baseUrl(props.getTransactionServiceBaseUrl())
                .clientConnector(connector(Duration.ofSeconds(10)))
                .codecs(config -> config.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    /**
     * Cliente para llamar al endpoint interno de auth-service que devuelve
     * las API keys descifradas del usuario (provider keys del chat/RAG).
     * Servicio interno y rápido: timeout corto (5s).
     */
    @Bean
    public WebClient authServiceWebClient(AiProperties props) {
        return WebClient.builder()
                .baseUrl(props.getAuthServiceBaseUrl())
                .clientConnector(connector(Duration.ofSeconds(5)))
                .codecs(config -> config.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }
}
