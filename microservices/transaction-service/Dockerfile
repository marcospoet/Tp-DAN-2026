# ============================================================
# Dockerfile — transaction-service
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

RUN mvn -pl transaction-service dependency:go-offline -q

COPY transaction-service/src ./transaction-service/src
RUN mvn -pl transaction-service clean package -DskipTests -q

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=builder /workspace/transaction-service/target/*.jar app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
