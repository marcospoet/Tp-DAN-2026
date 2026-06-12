package com.pesito.ai.repository;

import com.pesito.ai.model.ChatMemory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ChatMemoryRepository extends MongoRepository<ChatMemory, String> {

    List<ChatMemory> findTop500ByUserIdOrderByCreatedAtDesc(String userId);

    boolean existsByUserIdAndContentHash(String userId, String contentHash);

    long countByUserId(String userId);

    List<ChatMemory> findTop100ByUserIdOrderByCreatedAtAsc(String userId);

    long deleteByCreatedAtBefore(LocalDateTime cutoff);
}
