# ============================================================
# Dockerfile — api-gateway
# Build context: ./microservices  (desde el docker-compose.yml)
# ============================================================

# ---- Stage 1: Build ----
FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /workspace

COPY pom.xml ./pom.xml
COPY eureka-server/pom.xml       ./eureka-server/pom.xml
COPY api-gateway/pom.xml         ./api-gateway/pom.xml
COPY auth-service/pom.xml        ./auth-service/pom.xml
COPY transaction-service/pom.xml ./transaction-service/pom.xml
COPY ai-service/pom.xml          ./ai-service/pom.xml

RUN mvn -pl api-gateway dependency:go-offline -q

COPY api-gateway/src ./api-gateway/src
RUN mvn -pl api-gateway clean package -DskipTests -q

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /workspace/api-gateway/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
