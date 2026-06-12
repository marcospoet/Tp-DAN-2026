param(
    [switch]$SkipBuild
)

# Apuntar docker al daemon de minikube
minikube docker-env | Invoke-Expression

# Namespace, secrets y configmaps
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-secrets.yaml
kubectl apply -f k8s/02-configmaps.yaml

if (-not $SkipBuild) {
    docker build -f microservices/ai-service/Dockerfile          -t pesito/ai-service:latest          ./microservices
    docker build -f microservices/auth-service/Dockerfile         -t pesito/auth-service:latest         ./microservices
    docker build -f microservices/transaction-service/Dockerfile  -t pesito/transaction-service:latest  ./microservices
    docker build -f microservices/eureka-server/Dockerfile        -t pesito/eureka-server:latest        ./microservices
    docker build -f microservices/api-gateway/Dockerfile          -t pesito/api-gateway:latest          ./microservices
    docker build -f microservices/frontend-service/Dockerfile     -t pesito/frontend-service:latest     ./microservices/frontend-service
}

kubectl apply -f k8s/infrastructure/
kubectl apply -f k8s/microservices/
kubectl scale deployment oauth2-proxy -n pesito --replicas=0

kubectl get pods -n pesito -w
