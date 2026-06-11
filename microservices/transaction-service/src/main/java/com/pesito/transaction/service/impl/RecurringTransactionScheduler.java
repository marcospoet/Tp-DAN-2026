package com.pesito.transaction.service.impl;

import com.pesito.transaction.entity.Transaction;
import com.pesito.transaction.messaging.TransactionCreatedEvent;
import com.pesito.transaction.repository.TransactionRepository;
import com.pesito.transaction.service.ExchangeRateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Genera automáticamente la próxima ocurrencia de cada transacción marcada como
 * recurrente (isRecurring=true) cuando se cumple su frecuencia (weekly, biweekly,
 * monthly, annual), sin requerir acción manual del usuario.
 *
 * Para cada serie (mismo usuario + descripción + categoría + frecuencia) se toma
 * la transacción más reciente como plantilla y se generan todas las ocurrencias
 * vencidas hasta hoy (cubre el caso de usuarios que no abren la app por un tiempo).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RecurringTransactionScheduler {

    // Tope de ocurrencias generadas por serie en una corrida, para evitar bucles
    // descontrolados si una serie quedó con datos inconsistentes.
    private static final int MAX_OCCURRENCES_PER_RUN = 24;

    private final TransactionRepository transactionRepository;
    private final ExchangeRateService exchangeRateService;
    private final ApplicationEventPublisher eventPublisher;

    // Corre todos los días a las 03:30 AM
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void generateDueOccurrences() {
        LocalDate today = LocalDate.now();

        Map<String, Transaction> latestBySeries = new LinkedHashMap<>();
        for (Transaction tx : transactionRepository.findByIsRecurringTrueOrderByDateDesc()) {
            if (tx.getRecurringFrequency() == null || tx.getRecurringFrequency().isBlank()) continue;
            latestBySeries.putIfAbsent(seriesKey(tx), tx);
        }

        int created = 0;
        for (Transaction template : latestBySeries.values()) {
            LocalDate next = addPeriod(template.getDate(), template.getRecurringFrequency());
            int guard = 0;
            while (!next.isAfter(today) && guard < MAX_OCCURRENCES_PER_RUN) {
                Transaction occurrence = buildNextOccurrence(template, next);
                Transaction saved = transactionRepository.save(occurrence);
                eventPublisher.publishEvent(new TransactionCreatedEvent(saved));
                created++;
                template = saved;
                next = addPeriod(template.getDate(), template.getRecurringFrequency());
                guard++;
            }
        }

        if (created > 0) {
            log.info("RecurringTransactionScheduler: {} transacciones recurrentes generadas automáticamente", created);
        }
    }

    private String seriesKey(Transaction tx) {
        String category = tx.getCategory() == null ? "" : tx.getCategory().toLowerCase();
        return tx.getUserId() + "::" + tx.getDescription().toLowerCase() + "::" + category
                + "::" + tx.getRecurringFrequency().toLowerCase();
    }

    private LocalDate addPeriod(LocalDate date, String frequency) {
        return switch (frequency.toLowerCase()) {
            case "weekly" -> date.plusWeeks(1);
            case "biweekly" -> date.plusWeeks(2);
            case "annual" -> date.plusYears(1);
            default -> date.plusMonths(1); // monthly
        };
    }

    private Transaction buildNextOccurrence(Transaction template, LocalDate date) {
        Transaction occurrence = Transaction.builder()
                .userId(template.getUserId())
                .description(template.getDescription())
                .amount(template.getAmount())
                .type(template.getType())
                .icon(template.getIcon())
                .category(template.getCategory())
                .date(date)
                .observation(template.getObservation())
                .currency(template.getCurrency())
                .exchangeRateType(template.getExchangeRateType())
                .account(template.getAccount())
                .recurringFrequency(template.getRecurringFrequency())
                .isRecurring(true)
                .build();

        if ("USD".equalsIgnoreCase(template.getCurrency())) {
            occurrence.setAmountUsd(template.getAmount());
        }

        String exRateType = template.getExchangeRateType();
        if (exRateType != null && !"MANUAL".equalsIgnoreCase(exRateType)) {
            try {
                occurrence.setTxRate(exchangeRateService.getSellRate(exRateType));
                if (!"USD".equalsIgnoreCase(template.getCurrency())) {
                    occurrence.setAmountUsd(exchangeRateService.convertArsToUsd(template.getAmount(), exRateType));
                }
            } catch (Exception e) {
                log.warn("No se pudo actualizar la cotización para la ocurrencia recurrente de '{}': {}",
                        template.getDescription(), e.getMessage());
                occurrence.setTxRate(template.getTxRate());
                occurrence.setAmountUsd(template.getAmountUsd());
            }
        } else {
            occurrence.setTxRate(template.getTxRate());
            occurrence.setAmountUsd(template.getAmountUsd());
        }

        return occurrence;
    }
}
