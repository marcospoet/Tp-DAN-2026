package com.budgetbuddy.ai.dto;

public class ParseRequest {

    private String input = "";
    private String imageBase64;
    private String imageMimeType = "image/jpeg";
    private String todayDate;
    private String provider;
    private String apiKey;

    public String getInput() { return input; }
    public void setInput(String input) { this.input = input; }

    public String getImageBase64() { return imageBase64; }
    public void setImageBase64(String imageBase64) { this.imageBase64 = imageBase64; }

    public String getImageMimeType() { return imageMimeType; }
    public void setImageMimeType(String imageMimeType) { this.imageMimeType = imageMimeType; }

    public String getTodayDate() { return todayDate; }
    public void setTodayDate(String todayDate) { this.todayDate = todayDate; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
}
