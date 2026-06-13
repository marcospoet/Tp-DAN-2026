# ============================================================
# dev-verify-account.ps1
#
# SOLO PARA DESARROLLO LOCAL.
# Marca como verificado el email de una cuenta de prueba,
# directo en la base del contenedor bb-postgres (docker-compose).
#
# Util cuando no hay forma de recibir el mail de verificacion
# en localhost (no hay SMTP real configurado).
#
# Este script asume el contenedor "bb-postgres" levantado por
# docker-compose.yml en este repo. NO existe (ni debe agregarse)
# un equivalente para produccion: ahi la verificacion de email
# es obligatoria y se hace por mail real.
#
# Uso:
#   ./dev-verify-account.ps1 -Email test@local.dev
# ============================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$Email
)

if ($Email -notmatch '^[^\s'']+@[^\s'']+\.[^\s'']+$') {
    Write-Error "Email invalido: $Email"
    exit 1
}

$container = "bb-postgres"

$running = docker ps --filter "name=$container" --format "{{.Names}}"
if ($running -ne $container) {
    Write-Error "El contenedor '$container' no esta corriendo. Este script es solo para el entorno local de docker-compose."
    exit 1
}

$sql = @"
UPDATE auth.users
SET email_verified = true,
    email_verification_token = NULL,
    email_verification_expiry = NULL
WHERE email = '$Email'
RETURNING email, email_verified;
"@

docker exec -i $container psql -U postgres -d pesito -c $sql
