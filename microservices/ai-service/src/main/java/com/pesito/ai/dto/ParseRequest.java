package com.pesito.ai.dto;

import jakarta.validation.constraints.Size;

public class ParseRequest {

    @Size(max = 4000, message = "El texto no puede superar los 4000 caracteres.")
    private String input = "";

    // ~10 MB en base64 (~7.5 MB binario) por adjunto
    @Size(max = 10_000_000, message = "La imagen adjunta es demasiado grande.")
    private String imageBase64;

    @Size(max = 50)
    private String imageMimeType = "image/jpeg";

    @Size(max = 10_000_000, message = "El archivo adjunto es demasiado grande.")
    private String fileBase64;

    @Size(max = 50)
    private String fileMimeType;

    @Size(max = 20)
    private String todayDate;

    @Size(max = 20)
    private String provider;

    public String getInput() { return input; }
    public void setInput(String input) { this.input = input; }

    public String getImageBase64() { return imageBase64; }
    public void setImageBase64(String imageBase64) { this.imageBase64 = imageBase64; }

    public String getImageMimeType() { return imageMimeType; }
    public void setImageMimeType(String imageMimeType) { this.imageMimeType = imageMimeType; }

    public String getFileBase64() { return fileBase64; }
    public void setFileBase64(String fileBase64) { this.fileBase64 = fileBase64; }

    public String getFileMimeType() { return fileMimeType; }
    public void setFileMimeType(String fileMimeType) { this.fileMimeType = fileMimeType; }

    public String getTodayDate() { return todayDate; }
    public void setTodayDate(String todayDate) { this.todayDate = todayDate; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
