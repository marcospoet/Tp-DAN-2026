package com.budgetbuddy.transaction.messaging;

import com.budgetbuddy.transaction.entity.Transaction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class TransactionEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishTransactionCreated(Transaction transaction) {
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
