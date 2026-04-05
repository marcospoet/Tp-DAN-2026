package com.budgetbuddy.transaction.messaging;

import com.budgetbuddy.transaction.service.ITransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserEventConsumer {

    private final ITransactionService transactionService;

    @RabbitListener(queues = RabbitConfig.QUEUE_USER_DELETED)
    public void onUserDeleted(Map<String, Object> payload) {
        String userIdStr = (String) payload.get("userId");
        if (userIdStr == null) {
            log.warn("Evento user.deleted recibido sin userId, se ignora");
            return;
        }

        UUID userId = UUID.fromString(userIdStr);
        log.info("Evento user.deleted recibido: userId={}, eliminando transacciones...", userId);
        transactionService.deleteAllByUser(userId);
    }
}
