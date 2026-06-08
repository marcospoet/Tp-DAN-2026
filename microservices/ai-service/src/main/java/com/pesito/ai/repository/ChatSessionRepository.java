package com.pesito.ai.repository;

import com.pesito.ai.model.ChatSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ChatSessionRepository extends MongoRepository<ChatSession, String> {

    Optional<ChatSession> findTopByUserIdOrderByUpdatedAtDesc(String userId);

    List<ChatSession> findByUserIdOrderByUpdatedAtDesc(String userId);

    long deleteByUpdatedAtBefore(LocalDateTime cutoff);
}
