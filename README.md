# Sistema de Logs

Sistema completo para registro e visualização de logs contendo CPF, MAC Address e horário.

## Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│     Nginx       │────▶│    API Node.js  │────▶│   PostgreSQL    │
│   (porta 80)    │     │   (porta 3000)  │     │   (porta 5432)  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     │
     │ Autenticação
     │ Basic Auth
     ▼
  Página Web
  de Relatórios
```

## Requisitos

- Docker
- Docker Compose

## Iniciar o Sistema

```bash
# Clonar/copiar os arquivos para um diretório
cd log-system

# Iniciar todos os containers
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f
```

## Acessos

### Página Web de Relatórios

- **URL:** http://localhost
- **Usuário:** `admin`
- **Senha:** `admin123`

### API Endpoints

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| POST | `/api/logs` | Criar novo log | Não |
| GET | `/api/logs` | Listar logs | Sim |
| GET | `/api/logs/stats` | Estatísticas | Sim |
| GET | `/api/logs/search` | Buscar logs | Sim |
| GET | `/api/health` | Health check | Não |

### Exemplos de Uso da API

**Criar um novo log (POST - sem autenticação):**
```bash
curl -X POST http://localhost/api/logs \
  -H "Content-Type: application/json" \
  -d '{"cpf": "123.456.789-00", "macaddress": "AA:BB:CC:DD:EE:FF"}'
```

**Listar logs (GET - com autenticação):**
```bash
curl -u admin:admin123 http://localhost/api/logs
```

**Buscar por CPF:**
```bash
curl -u admin:admin123 "http://localhost/api/logs/search?cpf=123"
```

**Ver estatísticas:**
```bash
curl -u admin:admin123 http://localhost/api/logs/stats
```

## Estrutura do Projeto

```
log-system/
├── docker-compose.yml      # Orquestração dos containers
├── README.md               # Este arquivo
│
├── db/                     # PostgreSQL
│   ├── Dockerfile
│   └── init.sql            # Script de criação da tabela
│
├── api/                    # API Node.js
│   ├── Dockerfile
│   ├── package.json
│   └── server.js           # Código da API
│
└── nginx/                  # Servidor Web
    ├── Dockerfile
    ├── nginx.conf          # Configuração principal
    ├── .htpasswd           # Credenciais de acesso
    ├── conf.d/
    │   └── default.conf    # Configuração do servidor
    └── html/
        └── index.html      # Página de relatórios
```

## Banco de Dados

### Tabela `logs`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL | Chave primária |
| cpf | VARCHAR(14) | CPF do usuário |
| mac_address | VARCHAR(17) | Endereço MAC |
| horario | TIMESTAMP | Data/hora do registro |

### Acessar PostgreSQL diretamente

```bash
docker exec -it log-postgres psql -U loguser -d logdb
```

## Segurança

### Alterar Credenciais de Acesso

1. Gerar novo hash de senha:
```bash
docker run --rm httpd:alpine htpasswd -nb seu_usuario sua_senha > nginx/.htpasswd
```

2. Editar arquivo `nginx/.htpasswd` com a saída do comando

3. Reiniciar o Nginx:
```bash
docker-compose restart nginx
```

### Variáveis de Ambiente

Edite o `docker-compose.yml` para alterar:

- `POSTGRES_USER` - Usuário do banco
- `POSTGRES_PASSWORD` - Senha do banco
- `POSTGRES_DB` - Nome do banco

## Comandos Úteis

```bash
# Parar todos os containers
docker-compose down

# Parar e remover volumes (dados)
docker-compose down -v

# Rebuild após alterações
docker-compose up -d --build

# Ver logs de um serviço específico
docker-compose logs -f api
docker-compose logs -f nginx
docker-compose logs -f postgres

# Acessar shell do container
docker exec -it log-api sh
docker exec -it log-nginx sh
```

## Troubleshooting

**Erro de conexão com banco:**
```bash
# Verificar se o postgres está rodando
docker-compose ps postgres

# Ver logs do postgres
docker-compose logs postgres
```

**API não responde:**
```bash
# Verificar health
curl http://localhost:3000/health

# Ver logs
docker-compose logs api
```

**Página não carrega:**
```bash
# Verificar nginx
docker-compose logs nginx

# Testar configuração
docker exec log-nginx nginx -t
```
