package com.pesito.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.provider.CommonOAuth2Provider;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Configuration
public class OAuth2ClientConfig {

    @Value("${GOOGLE_CLIENT_ID:}")
    private String googleClientId;

    @Value("${GOOGLE_CLIENT_SECRET:}")
    private String googleClientSecret;

    @Value("${GITHUB_CLIENT_ID:}")
    private String githubClientId;

    @Value("${GITHUB_CLIENT_SECRET:}")
    private String githubClientSecret;

    @Value("${OAUTH2_REDIRECT_BASE_URL:http://localhost:8080}")
    private String redirectBase;

    @Bean
    @ConditionalOnExpression(
        "T(org.springframework.util.StringUtils).hasText('${GOOGLE_CLIENT_ID:}') " +
        "|| T(org.springframework.util.StringUtils).hasText('${GITHUB_CLIENT_ID:}')"
    )
    public ClientRegistrationRepository clientRegistrationRepository() {
        List<ClientRegistration> registrations = new ArrayList<>();

        if (StringUtils.hasText(googleClientId)) {
            registrations.add(CommonOAuth2Provider.GOOGLE.getBuilder("google")
                .clientId(googleClientId)
                .clientSecret(googleClientSecret)
                .scope("openid", "profile", "email")
                .redirectUri(redirectBase + "/login/oauth2/code/google")
                .build());
        }

        if (StringUtils.hasText(githubClientId)) {
            registrations.add(CommonOAuth2Provider.GITHUB.getBuilder("github")
                .clientId(githubClientId)
                .clientSecret(githubClientSecret)
                .scope("read:user", "user:email")
                .redirectUri(redirectBase + "/login/oauth2/code/github")
                .build());
        }

        return new InMemoryClientRegistrationRepository(registrations);
    }
}
