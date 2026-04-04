package com.budgetbuddy.ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * AI Service — Procesamiento AI y Analytics de BudgetBuddy.
 *
 * Responsabilidades:
 *  - Recibir texto/imagen/audio y llamar al proveedor AI configurado
 *    (Claude, OpenAI, Gemini) para parsear transacciones (POST /api/ai/parse)
 *  - Gestionar historial de conversaciones del chat financiero
 *    (POST /api/ai/chat, GET /api/ai/chat/{userId})
 *  - Computar analytics: tendencias mensuales, breakdown por categoria,
 *    proyeccion a fin de mes (GET /api/ai/analytics/{userId})
 *  - Consumir evento transaction.created → invalidar cache de analytics
 *
 * Base de datos: MongoDB (unica base NoSQL del sistema)
 *  Colecciones: chat_sessions, chat_messages, analytics_cache
 *  Este servicio NO accede a PostgreSQL (ni schema auth ni txn).
 *  Para construir el contexto financiero, recibe los datos de transacciones
 *  como parametro en el request (el frontend los envia desde su estado local).
 *
 * TODO (Fase 3 — implementar en este orden):
 *  1. Documentos MongoDB: ChatSession, ChatMessage, AnalyticsCache
 *  2. Repositorios: ChatSessionRepository, ChatMessageRepository (Spring Data MongoDB)
 *  3. Servicio: AiProviderService (WebClient → Claude/OpenAI/Gemini segun config)
 *  4. Servicio: ChatService (CRUD de historial, rolling compression)
 *  5. Servicio: AnalyticsService (calculos de tendencia, proyeccion, cache en MongoDB)
 *  6. Controlador: AiController
 *  7. Consumidor RabbitMQ: TransactionEventConsumer (escucha transaction.created)
 */
@SpringBootApplication
@EnableDiscoveryClient
public class AiServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiServiceApplication.class, args);
    }
}
