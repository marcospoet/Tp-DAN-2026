package com.budgetbuddy.transaction;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Transaction Service — Transacciones financieras de BudgetBuddy.
 *
 * Responsabilidades:
 *  - CRUD de transacciones (POST/GET/PUT/DELETE /api/transactions)
 *  - Proxy de cotizaciones ARS/USD hacia DolarAPI (GET /api/rates)
 *  - Upload de comprobantes a MinIO (POST /api/transactions/{id}/receipt)
 *  - Exportacion CSV y PDF del historial
 *  - Consumir evento user.deleted → limpiar transacciones del usuario
 *  - Publicar evento transaction.created → invalidar cache en ai-service
 *
 * Base de datos: PostgreSQL, schema "txn"
 *  Tablas: txn.transactions, txn.receipts
 *  Migraciones gestionadas por Flyway (src/main/resources/db/migration/)
 *
 * Nota de diseño (Single Source of Truth):
 *  user_id en transactions NO tiene FK fisica hacia auth.users.
 *  La integridad se mantiene via evento async user.deleted de RabbitMQ.
 *  Este servicio NO accede al schema "auth" ni a MongoDB.
 *
 * TODO (Fase 3 — implementar en este orden):
 *  1. Entidades JPA: Transaction, Receipt
 *  2. Repositorios: TransactionRepository (con queries por user_id y rango de fechas)
 *  3. Servicio: ExchangeRateService (WebClient → DolarAPI con Resilience4J Retry)
 *  4. Servicio: TransactionService (CRUD, paginacion, filtros temporales)
 *  5. Controlador: TransactionController
 *  6. Consumidor RabbitMQ: UserEventConsumer (escucha user.deleted)
 *  7. Publicador RabbitMQ: TransactionEventPublisher
 */
@SpringBootApplication
@EnableDiscoveryClient
public class TransactionServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(TransactionServiceApplication.class, args);
    }
}
