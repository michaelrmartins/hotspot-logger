FROM postgres:16-alpine

# Copiar script de inicialização
COPY init.sql /docker-entrypoint-initdb.d/

# Expor porta padrão
EXPOSE 5432
