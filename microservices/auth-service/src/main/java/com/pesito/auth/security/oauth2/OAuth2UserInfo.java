package com.pesito.auth.security.oauth2;

public interface OAuth2UserInfo {
    String getId();
    String getEmail();
    String getName();
}
