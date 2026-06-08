package com.pesito.ai.dto;

public class ChatTurnDto {

    private String role; // "user" | "assistant"
    private String text;

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
}
