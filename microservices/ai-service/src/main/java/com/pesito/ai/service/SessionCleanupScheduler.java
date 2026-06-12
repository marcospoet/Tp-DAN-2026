package com.pesito.ai.service;

import com.pesito.ai.repository.ChatMemoryRepository;
import com.pesito.ai.repository.ChatSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class SessionCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(SessionCleanupScheduler.class);
    private static final int SESSION_TTL_DAYS = 30;
    private static final int MEMORY_TTL_DAYS = 90;

    private final ChatSessionRepository sessionRepo;
    private final ChatMemoryRepository memoryRepo;

    public SessionCleanupScheduler(ChatSessionRepository sessionRepo, ChatMemoryRepository memoryRepo) {
        this.sessionRepo = sessionRepo;
        this.memoryRepo = memoryRepo;
    }

    // Corre todos los días a las 03:00 AM
    @Scheduled(cron = "0 0 3 * * *")
    public void deleteExpiredSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(SESSION_TTL_DAYS);
        long deleted = sessionRepo.deleteByUpdatedAtBefore(cutoff);
        if (deleted > 0) {
            log.info("SessionCleanup: {} sesiones eliminadas (inactivas > {} días)", deleted, SESSION_TTL_DAYS);
        }
        long deletedMemories = memoryRepo.deleteByCreatedAtBefore(LocalDateTime.now().minusDays(MEMORY_TTL_DAYS));
        if (deletedMemories > 0) {
            log.info("SessionCleanup: {} memorias semánticas eliminadas (> {} días)", deletedMemories, MEMORY_TTL_DAYS);
        }
    }
}
