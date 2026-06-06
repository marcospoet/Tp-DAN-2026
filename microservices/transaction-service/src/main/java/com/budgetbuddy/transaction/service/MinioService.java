package com.budgetbuddy.transaction.service;

import com.budgetbuddy.transaction.exception.MinioException;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class MinioService {

    private final MinioClient minioClient;

    @Value("${minio.bucket:receipts}")
    private String bucket;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureBucketExists() {
        try {
            boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                log.info("Bucket '{}' creado en MinIO", bucket);
            }
        } catch (Exception e) {
            log.warn("No se pudo verificar/crear bucket MinIO '{}': {}", bucket, e.getMessage());
        }
    }

    public String upload(UUID userId, String originalFilename, InputStream stream, long size, String contentType) {
        String ext = extractExtension(originalFilename);
        String objectName = userId + "/" + UUID.randomUUID() + "." + ext;
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(stream, size, -1)
                    .contentType(contentType)
                    .build());
            log.info("Receipt subido: bucket={} object={}", bucket, objectName);
            return objectName;
        } catch (Exception e) {
            throw new MinioException("Error al subir archivo a MinIO: " + e.getMessage(), e);
        }
    }

    public void delete(String objectName) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .build());
            log.info("Receipt eliminado: bucket={} object={}", bucket, objectName);
        } catch (Exception e) {
            throw new MinioException("Error al eliminar archivo de MinIO: " + e.getMessage(), e);
        }
    }

    public String getPresignedUrl(String objectName) {
        try {
            return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .method(Method.GET)
                    .expiry(1, TimeUnit.HOURS)
                    .build());
        } catch (Exception e) {
            throw new MinioException("Error al generar URL de descarga: " + e.getMessage(), e);
        }
    }

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "bin";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
