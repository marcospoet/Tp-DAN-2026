package com.budgetbuddy.transaction.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class TransactionEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onTransactionCreated(TransactionCreatedEvent event) {
        var transaction = event.transaction();
        Map<String, Object> payload = Map.of(
                "transactionId", transaction.getId().toString(),
                "userId",        transaction.getUserId().toString(),
                "amount",        transaction.getAmount(),
                "type",          transaction.getType(),
                "currency",      transaction.getCurrency(),
                "event",         "transaction.created"
        );

        rabbitTemplate.convertAndSend(
                RabbitConfig.EXCHANGE,
                RabbitConfig.KEY_TRANSACTION_CREATED,
                payload
        );

        log.info("Evento transaction.created publicado: transactionId={}, userId={}",
                transaction.getId(), transaction.getUserId());
    }
}
