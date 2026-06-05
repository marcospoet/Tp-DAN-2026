package com.budgetbuddy.ai.dto;

public class DetectIntentRequest {

    private String message;
    private String intentType; // "delete" | "update" | "recurring" | "csv"
    private String todayDate;

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getIntentType() { return intentType; }
    public void setIntentType(String intentType) { this.intentType = intentType; }

    public String getTodayDate() { return todayDate; }
    public void setTodayDate(String todayDate) { this.todayDate = todayDate; }
}
