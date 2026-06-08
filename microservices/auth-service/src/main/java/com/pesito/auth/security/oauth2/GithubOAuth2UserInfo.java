package com.pesito.auth.security.oauth2;

import java.util.Map;

public class GithubOAuth2UserInfo implements OAuth2UserInfo {

    private final Map<String, Object> attributes;
    private final String emailOverride;

    public GithubOAuth2UserInfo(Map<String, Object> attributes) {
        this(attributes, null);
    }

    public GithubOAuth2UserInfo(Map<String, Object> attributes, String emailOverride) {
        this.attributes = attributes;
        this.emailOverride = emailOverride;
    }

    @Override
    public String getId() {
        Object id = attributes.get("id");
        return id != null ? String.valueOf(id) : null;
    }

    @Override
    public String getEmail() {
        if (emailOverride != null) return emailOverride;
        return (String) attributes.get("email");
    }

    @Override
    public String getName() {
        String name = (String) attributes.get("name");
        return name != null ? name : (String) attributes.get("login");
    }
}
