package com.budgetbuddy.auth.messaging;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class UserEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishUserRegistered(UUID userId, String email) {
        rabbitTemplate.convertAndSend(
            RabbitConfig.EXCHANGE,
            RabbitConfig.KEY_USER_REGISTERED,
            Map.of("userId", userId.toString(), "email", email, "event", "user.registered")
        );
    }

    public void publishUserDeleted(UUID userId, String email) {
        rabbitTemplate.convertAndSend(
            RabbitConfig.EXCHANGE,
            RabbitConfig.KEY_USER_DELETED,
            Map.of("userId", userId.toString(), "email", email, "event", "user.deleted")
        );
    }
}
