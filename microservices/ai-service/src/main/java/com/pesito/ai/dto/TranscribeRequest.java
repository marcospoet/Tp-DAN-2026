package com.pesito.ai.dto;

public class TranscribeRequest {

    private String audioBase64;
    private String mimeType = "audio/webm";
    private String provider;

    public String getAudioBase64() { return audioBase64; }
    public void setAudioBase64(String audioBase64) { this.audioBase64 = audioBase64; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
