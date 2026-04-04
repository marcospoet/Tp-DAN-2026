# ============================================================
# Dockerfile — eureka-server
# Build context: ./microservices  (desde el docker-compose.yml)
# ============================================================

# ---- Stage 1: Build ----
FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /workspace

# Copiar el parent POM y los pom.xml de TODOS los módulos del reactor.
# Maven necesita verlos todos para validar la estructura multi-módulo
# antes de poder compilar cualquier módulo individual con -pl.
COPY pom.xml ./pom.xml
COPY eureka-server/pom.xml       ./eureka-server/pom.xml
COPY api-gateway/pom.xml         ./api-gateway/pom.xml
COPY auth-service/pom.xml        ./auth-service/pom.xml
COPY transaction-service/pom.xml ./transaction-service/pom.xml
COPY ai-service/pom.xml          ./ai-service/pom.xml

# Descargar dependencias (aprovecha cache de capas si no cambiaron los pom.xml)
RUN mvn -pl eureka-server dependency:go-offline -q

# Copiar fuentes y compilar
COPY eureka-server/src ./eureka-server/src
RUN mvn -pl eureka-server clean package -DskipTests -q

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /workspace/eureka-server/target/*.jar app.jar

EXPOSE 8761

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
