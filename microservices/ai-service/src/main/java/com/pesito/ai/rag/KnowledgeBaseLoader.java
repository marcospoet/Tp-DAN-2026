package com.pesito.ai.rag;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Lee los documentos curados de la knowledge base (Markdown + PDF) desde el classpath.
 * Fase 1 de RAG: contenido estático embebido en el jar de ai-service.
 */
@Component
public class KnowledgeBaseLoader {

    public List<KnowledgeSource> load() {
        List<KnowledgeSource> sources = new ArrayList<>();
        sources.addAll(loadResources("classpath*:knowledge-base/markdown/*.md", this::readText));
        sources.addAll(loadResources("classpath*:knowledge-base/pdf/*.pdf", this::readPdf));
        return sources;
    }

    private List<KnowledgeSource> loadResources(String pattern, ResourceReader reader) {
        List<KnowledgeSource> result = new ArrayList<>();
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources(pattern);
            for (Resource resource : resources) {
                String content = reader.read(resource);
                if (content != null && !content.isBlank()) {
                    result.add(new KnowledgeSource(resource.getFilename(), content));
                }
            }
        } catch (Exception ignored) {
            // No hay archivos que matcheen el patrón (carpeta vacía, ej. pdf/)
        }
        return result;
    }

    private String readText(Resource resource) throws Exception {
        try (InputStream in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String readPdf(Resource resource) throws Exception {
        try (InputStream in = resource.getInputStream();
             var document = Loader.loadPDF(in.readAllBytes())) {
            return new PDFTextStripper().getText(document);
        }
    }

    @FunctionalInterface
    private interface ResourceReader {
        String read(Resource resource) throws Exception;
    }
}
