package com.pesito.auth.messaging;

import java.util.UUID;

public record UserDeletedEvent(UUID userId, String email) {}
