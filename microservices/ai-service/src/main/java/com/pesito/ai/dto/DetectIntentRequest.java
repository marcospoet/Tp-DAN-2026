package com.pesito.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class DetectIntentRequest {

    @NotBlank(message = "El mensaje no puede estar vacío.")
    @Size(max = 2000, message = "El mensaje no puede superar los 2000 caracteres.")
    private String message;

    @Size(max = 20)
    private String intentType; // "delete" | "update" | "recurring" | "csv"

    @Size(max = 20)
    private String todayDate;

    @Size(max = 20)
    private String provider;

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getIntentType() { return intentType; }
    public void setIntentType(String intentType) { this.intentType = intentType; }

    public String getTodayDate() { return todayDate; }
    public void setTodayDate(String todayDate) { this.todayDate = todayDate; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
