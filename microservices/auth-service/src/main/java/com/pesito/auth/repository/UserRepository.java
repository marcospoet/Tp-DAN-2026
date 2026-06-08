package com.pesito.auth.repository;

import com.pesito.auth.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    // LEFT JOIN FETCH profile en una sola query — elimina el N+1 de FetchType.LAZY
    @EntityGraph(attributePaths = "profile")
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByProviderAndProviderId(String provider, String providerId);

    Optional<User> findByEmailVerificationToken(String token);
}
