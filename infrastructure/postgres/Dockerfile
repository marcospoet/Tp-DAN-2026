# ============================================================
# PostgreSQL 16 (Alpine) + extensión pgvector
# Se compila pgvector desde fuente para mantener el mismo
# libc/locale (musl) que el volumen postgres_data existente.
# ============================================================
FROM postgres:16-alpine

RUN apk add --no-cache --virtual .build-deps build-base git postgresql-dev clang19 llvm19 \
    && git clone --branch v0.7.4 --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector && make OPTFLAGS="" && make install \
    && cd / && rm -rf /tmp/pgvector \
    && apk del .build-deps
