package com.pesito.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class TranscribeRequest {

    @NotBlank(message = "No se recibió audio.")
    @Size(max = 30_000_000, message = "El audio es demasiado grande.")
    private String audioBase64;

    @Size(max = 50)
    private String mimeType = "audio/webm";

    @Size(max = 20)
    private String provider;

    public String getAudioBase64() { return audioBase64; }
    public void setAudioBase64(String audioBase64) { this.audioBase64 = audioBase64; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
