package com.pesito.auth.security.oauth2;

import com.pesito.auth.entity.Profile;
import com.pesito.auth.entity.User;
import com.pesito.auth.messaging.UserRegisteredEvent;
import com.pesito.auth.repository.ProfileRepository;
import com.pesito.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(request);
        String registrationId = request.getClientRegistration().getRegistrationId();

        OAuth2UserInfo userInfo = extractUserInfo(registrationId, oAuth2User, request);

        if (userInfo.getEmail() == null) {
            throw new OAuth2AuthenticationException(new OAuth2Error("email_not_found"),
                "No se encontró un email verificado en tu cuenta de " + registrationId +
                ". Hacélo público o usá otro método de registro.");
        }

        processOAuthUser(registrationId, userInfo);

        // Retorna un OAuth2User con email siempre presente en los atributos
        Map<String, Object> attrs = new HashMap<>(oAuth2User.getAttributes());
        attrs.put("email", userInfo.getEmail());
        String userNameAttr = request.getClientRegistration()
            .getProviderDetails().getUserInfoEndpoint().getUserNameAttributeName();
        return new DefaultOAuth2User(oAuth2User.getAuthorities(), attrs, userNameAttr);
    }

    private OAuth2UserInfo extractUserInfo(String provider, OAuth2User user, OAuth2UserRequest request) {
        return switch (provider) {
            case "google" -> new GoogleOAuth2UserInfo(user.getAttributes());
            case "github" -> {
                GithubOAuth2UserInfo info = new GithubOAuth2UserInfo(user.getAttributes());
                if (info.getEmail() == null) {
                    String token = request.getAccessToken().getTokenValue();
                    String email = fetchGithubPrimaryEmail(token);
                    yield new GithubOAuth2UserInfo(user.getAttributes(), email);
                }
                yield info;
            }
            default -> throw new OAuth2AuthenticationException(
                new OAuth2Error("unsupported_provider"), "Provider no soportado: " + provider);
        };
    }

    private String fetchGithubPrimaryEmail(String accessToken) {
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.set("Accept", "application/vnd.github+json");

        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
            "https://api.github.com/user/emails",
            HttpMethod.GET,
            new HttpEntity<>(headers),
            new ParameterizedTypeReference<>() {}
        );

        if (response.getBody() == null) return null;

        return response.getBody().stream()
            .filter(e -> Boolean.TRUE.equals(e.get("primary")) && Boolean.TRUE.equals(e.get("verified")))
            .map(e -> (String) e.get("email"))
            .findFirst()
            .orElse(null);
    }

    private void processOAuthUser(String provider, OAuth2UserInfo userInfo) {
        // Buscar por provider_id primero (usuario OAuth que ya existe)
        Optional<User> byProvider = userRepository.findByProviderAndProviderId(provider, userInfo.getId());
        if (byProvider.isPresent()) {
            User existing = byProvider.get();
            // Crear perfil si no existe (puede faltar por un intento de registro anterior fallido)
            if (!profileRepository.existsById(existing.getId())) {
                profileRepository.save(Profile.builder()
                    .user(existing)
                    .userName(userInfo.getName() != null ? userInfo.getName() : "Usuario")
                    .build());
            }
            return;
        }

        // Buscar por email (vincular OAuth a cuenta local existente)
        Optional<User> byEmail = userRepository.findByEmail(userInfo.getEmail());
        if (byEmail.isPresent()) {
            User user = byEmail.get();
            user.setProviderId(userInfo.getId());
            user.setEmailVerified(true);
            userRepository.save(user);
            return;
        }

        // Crear nuevo usuario OAuth
        User user = User.builder()
            .email(userInfo.getEmail())
            .provider(provider)
            .providerId(userInfo.getId())
            .emailVerified(true)
            .build();

        userRepository.save(user);

        // Guardar el perfil explicitamente — no depender del cascade en el lado inverso
        Profile profile = Profile.builder()
            .user(user)
            .userName(userInfo.getName() != null ? userInfo.getName() : "Usuario")
            .build();

        profileRepository.save(profile);
        eventPublisher.publishEvent(new UserRegisteredEvent(user.getId(), user.getEmail()));
    }
}
