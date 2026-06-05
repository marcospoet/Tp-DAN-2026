package com.budgetbuddy.ai.repository;

import com.budgetbuddy.ai.model.ChatSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ChatSessionRepository extends MongoRepository<ChatSession, String> {

    Optional<ChatSession> findTopByUserIdOrderByUpdatedAtDesc(String userId);
}
