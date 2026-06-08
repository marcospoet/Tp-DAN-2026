package com.pesito.ai.dto;

public class RawAiResponse {

    private String rawResponse;

    public RawAiResponse() {}

    public RawAiResponse(String rawResponse) {
        this.rawResponse = rawResponse;
    }

    public String getRawResponse() { return rawResponse; }
    public void setRawResponse(String rawResponse) { this.rawResponse = rawResponse; }
}
