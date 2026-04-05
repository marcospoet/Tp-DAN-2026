package com.budgetbuddy.transaction.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE = "budgetbuddy.events";
    public static final String QUEUE_USER_DELETED = "txn.user.deleted.queue";
    public static final String KEY_USER_DELETED = "user.deleted";
    public static final String KEY_TRANSACTION_CREATED = "transaction.created";

    @Bean
    public TopicExchange budgetbuddyExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE).durable(true).build();
    }

    @Bean
    public Queue txnUserDeletedQueue() {
        return QueueBuilder.durable(QUEUE_USER_DELETED).build();
    }

    @Bean
    public Binding txnUserDeletedBinding(Queue txnUserDeletedQueue, TopicExchange budgetbuddyExchange) {
        return BindingBuilder.bind(txnUserDeletedQueue)
                .to(budgetbuddyExchange)
                .with(KEY_USER_DELETED);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }
}
