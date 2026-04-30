# 📘 GALERIAS 360 — Documentação Completa do Projeto

**Versão:** 1.0  
**Data:** Abril 2026  
**Última Atualização:** 23 de Abril de 2026

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Projeto](#arquitetura-do-projeto)
3. [Tecnologias Utilizadas](#tecnologias-utilizadas)
4. [Setup e Instalação](#setup-e-instalação)
5. [Estrutura de Dados](#estrutura-de-dados)
6. [Documentação da API](#documentação-da-api)
7. [Autenticação e Autorização](#autenticação-e-autorização)
8. [WebSocket (Socket.IO)](#websocket-socketio)
9. [Estratégia para Aplicação Mobile](#estratégia-para-aplicação-mobile)
10. [Media Library](#media-library)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

# 1. Visão Geral

**Galerias 360** é uma plataforma de gestão e visualização de conteúdos interativos em 360º (panoramas, hotspots, trajetos, etc.).

### Características Principais

- ✅ Visualização de panoramas 360º (dome e sphere)
- ✅ Hotspots interativos (texto, imagem, vídeo, modelo 3D, áudio, etc.)
- ✅ Trajetos de navegação entre pontos
- ✅ Sistema de autenticação JWT
- ✅ Gestão de utilizadores e roles
- ✅ Estatísticas de visualização
- ✅ Temas personalizáveis
- ✅ WebSocket para comunicação em tempo real
- ✅ Suporte para aplicação mobile (read-only)

---

# 2. Arquitetura do Projeto

## Estrutura Geral

```
galerias360/
├── backend/                    # API REST (Node.js + Express)
│   ├── src/
│   │   ├── App.js             # Configuração principal da aplicação
│   │   ├── controllers/       # Lógica das rotas
│   │   ├── middleware/        # Middlewares (autenticação, CORS, etc.)
│   │   ├── models/            # Modelos de dados (Sequelize)
│   │   ├── routes/            # Definição das rotas
│   │   ├── services/          # Lógica de negócio
│   │   ├── utils/             # Funções auxiliares
│   │   ├── scripts/           # Scripts de setup/migração
│   │   └── uploads/           # Armazenamento de ficheiros
│   ├── package.json
│   └── .env                   # Variáveis de ambiente (não incluir no git)
│
└── frontend/                   # Interface Web (Next.js)
    ├── src/
    │   ├── app/               # Páginas e layout
    │   ├── components/        # Componentes React
    │   └── lib/               # Utilitários de frontend
    ├── public/               # Ficheiros estáticos
    ├── package.json
    └── .env.local            # Variáveis de ambiente (não incluir no git)
```

## Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                   │
│              React Components + Tailwind CSS            │
└─────────────────────────────────────────────────────────┘
                            │ HTTP/WebSocket
┌─────────────────────────────────────────────────────────┐
│                    Backend (Express)                    │
├─────────────────────────────────────────────────────────┤
│  Routes → Controllers → Services → Models (Sequelize)  │
├─────────────────────────────────────────────────────────┤
│               Middleware (Auth, CORS, etc.)             │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│           Database (PostgreSQL / MySQL)                 │
│         + File Storage (Uploads Directory)              │
└─────────────────────────────────────────────────────────┘
```

---

# 3. Tecnologias Utilizadas

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** Sequelize (suporta PostgreSQL, MySQL)
- **Autenticação:** JWT (jsonwebtoken)
- **WebSocket:** Socket.IO
- **Upload de Ficheiros:** Multer
- **Email:** Mailjet SDK
- **Encriptação:** Crypto (Node.js nativo)
- **Logging:** Winston ou console  
- **Desenvolvimento:** Nodemon

### Frontend
- **Framework:** Next.js (React)
- **Estilização:** Tailwind CSS
- **UI Components:** Shadcn/UI, Radix UI
- **HTTP Client:** Axios
- **State Management:** React Query (TanStack)
- **3D Graphics:** Three.js (react-three-fiber), Babylon.js
- **Panoramas:** A-Frame

### Base de Dados
- **Primary:** PostgreSQL
- **Alternative:** MySQL

---

# 4. Setup e Instalação

## Pré-requisitos

- Node.js (versão 18+)
- npm ou yarn
- PostgreSQL ou MySQL
- Git

## 4.1 Backend

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-username/galerias360.git
cd galerias360/backend
```

### 2. Instalar dependências

```bash
npm install --force
```

### 3. Configurar variáveis de ambiente

Criar ficheiro `.env` na raiz da pasta `backend/`:

```env
# Base de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=galerias360
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_DIALECT=postgres  # ou 'mysql' para MySQL

# JWT
JWT_SECRET=sua_chave_jwt_secreta_muito_segura
JWT_EXPIRES_IN=7d

# Encriptação de ficheiros
ENCRYPTION_KEY=sua_chave_encriptacao_aleatoria

# Email (Mailjet)
MJ_APIKEY_PUBLIC=chave_publica_mailjet
MJ_APIKEY_PRIVATE=chave_privada_mailjet
MAIL_FROM_EMAIL=seu_email@verificado.com
MAIL_FROM_NAME=Galerias 360

# URLs
FRONTEND_URL=http://localhost:3001
FRONTEND_URLS=http://localhost:3001,http://192.168.0.106:3001

# HTTP
PORT=3000
NODE_ENV=development

# Certificado SSL (opcional, para HTTPS)
HTTPS_CERT=/path/to/cert.pem
HTTPS_KEY=/path/to/key.pem
```

### 4. Iniciar a base de dados

```bash
# Criar base de dados (se não existir)
createdb galerias360

# Sincronizar modelos com BD (Sequelize)
npm run migrate  # se existir script
```

### 5. Iniciar o servidor

```bash
npm run dev
```

Server rodará em `http://localhost:3000`

---

## 4.2 Frontend

### 1. Navegar para a pasta frontend

```bash
cd ../frontend
```

### 2. Instalar dependências

```bash
npm install --force
```

### 3. Configurar variáveis de ambiente

Criar ficheiro `.env.local` na raiz da pasta `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
JWT_SECRET=mesma_chave_do_backend
```

### 4. Iniciar servidor de desenvolvimento

```bash
npm run dev
```

Frontend rodará em `http://localhost:3001`

---

## 4.3 Acesso em Rede Local

Para outros dispositivos da LAN acederem durante desenvolvimento:

**Backend:**
```env
# Na variável FRONTEND_URLS, incluir o IP local
FRONTEND_URLS=http://localhost:3001,http://192.168.0.106:3001
```

**Frontend:**
```bash
npm run dev -- -H 0.0.0.0 -p 3001
```

Aceder via `http://192.168.0.106:3001`

---

# 5. Estrutura de Dados

## Modelos Relacionais

### 1. **User** (Utilizadores)

```typescript
{
  id_user: INTEGER (PK),
  name: STRING,
  email: STRING (UNIQUE),
  password: STRING (hash bcrypt),
  id_role: INTEGER (FK → Role),
  active: BOOLEAN (default: true),
  email_confirmed: BOOLEAN (default: false),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

**Roles disponíveis:**
- `Admin` (id_role: 1) - Acesso total
- `User` (id_role: 2) - Acesso editor
- `Viewer` (id_role: 3) - Acesso apenas leitura (mobile)

---

### 2. **Ponto** (Panoramas 360)

```typescript
{
  id_ponto: INTEGER (PK),
  name: STRING,
  description: TEXT,
  latitude: FLOAT,
  longitude: FLOAT,
  id_categoria: INTEGER (FK),
  imagePath: STRING,
  image: BLOB('long'),  // Miniatura comprimida
  iv: STRING,            // Vector de inicialização (encriptação)
  panoramaShape: ENUM('dome', 'sphere'),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

**Relacionamentos:**
- Muitas categorias (via PontoCategoria)
- Muitos hotspots
- Múltiplos trajetos (via PontoTrajeto)

---

### 3. **Hotspot** (Interações nos Panoramas)

```typescript
{
  id_hotspot: INTEGER (PK),
  id_ponto: INTEGER (FK → Ponto),
  tipo: ENUM('texto', 'imagem', 'imagem4p', 'modelo3d', 'audio', 'audioespacial', 'video', 'link'),
  conteudo: TEXT,
  x: FLOAT,             // Coordenada 3D
  y: FLOAT,
  z: FLOAT,
  created_at: TIMESTAMP (opt),
  updated_at: TIMESTAMP (opt)
}
```

**Tipos de conteúdo:**
- `texto` - Texto simples ou rich text
- `imagem` - Imagem 2D
- `imagem4p` - 4 imagens (frente, trás, esquerda, direita)
- `modelo3d` - Modelo 3D (GLTF, OBJ)
- `audio` - Áudio mono
- `audioespacial` - Áudio 3D espacializado
- `video` - Vídeo MP4
- `link` - Link externo

---

### 4. **Trajeto** (Caminhos Guiados)

```typescript
{
  id_trajeto: INTEGER (PK),
  id_rota: INTEGER (FK → Rota),
  description: TEXT,
  video: STRING (URL ou caminho),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

**Relacionamentos:**
- Múltiplos pontos (via PontoTrajeto)
- Belongs to Rota

---

### 5. **CategoriaPonto** (Categorização)

```typescript
{
  id_categoria: INTEGER (PK),
  name: STRING,
  description: TEXT,
  icon: STRING,
  color: STRING,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

---

### 6. **Estatistica** (Visualizações)

```typescript
{
  id_estatistica: INTEGER (PK),
  id_ponto: INTEGER (FK → Ponto),
  id_user: INTEGER (FK → User),
  duracao_visualizacao: INTEGER (segundos),
  data_visualizacao: TIMESTAMP,
  dispositivo: STRING,
  coordenadas_globais: TEXT (JSON com lat/lon),
  created_at: TIMESTAMP
}
```

---

### 7. **Log** (Auditoria)

```typescript
{
  id_log: INTEGER (PK),
  id_user: INTEGER (FK → User),
  acao: STRING,           // 'CREATE', 'UPDATE', 'DELETE', etc.
  tabela_afetada: STRING,
  registro_id: INTEGER,
  dados_antigos: TEXT (JSON),
  dados_novos: TEXT (JSON),
  endereco_ip: STRING,
  timestamp: TIMESTAMP
}
```

---

### 8. **ThemePreset** (Personalização)

```typescript
{
  id_preset: INTEGER (PK),
  nome: STRING,
  descricao: TEXT,
  cores: TEXT (JSON),
  fontes: TEXT (JSON),
  layout: TEXT (JSON),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

---

### 9. **MapOverlay** (Sobreposições de Mapa)

```typescript
{
  id_overlay: INTEGER (PK),
  id_ponto: INTEGER (FK → Ponto),
  tipo: ENUM('polygon', 'circle', 'marker'),
  coordenadas: TEXT (GeoJSON),
  cor: STRING,
  label: STRING,
  created_at: TIMESTAMP
}
```

---

## Diagrama de Relacionamentos

```
╔═════════════════╗
║     User        ║
║  (id_user) ···· ║ 1
║   [Role FK]     ║
╚═════════════════╝
         │ 1
         │ n  has-many
         ↓
╔═════════════════╗         ╔═══════════════════╗
║   Ponto         ║ 1   n   ║  CategoriaPonto   ║
║ (id_ponto)      ║ ····---→║  (id_categoria)   ║
║   [many cats]   ║         ╚═══════════════════╝
║   [many hotspots║
║   [lat/lon]     ║
╚═════════════════╝
         │ 1
         │ n  has-many
         ↓
╔═════════════════╗
║   Hotspot       ║
║ (id_hotspot)    ║
║  [x, y, z]      ║
║  [tipo]         ║
║  [conteudo]     ║
╚═════════════════╝


╔═════════════════╗         ╔═══════════════════╗
║    Rota         ║ 1   n   ║  Trajeto          ║
║  (id_rota)      ║ ····→ ║ (id_trajeto)      ║
╚═════════════════╝         ╚═══════════════════╝
                                     │ n
                                     │ many-to-many
                        ┌────────────┴────────────┐
                        ↓                         ↓
                   ┌──────────────┐        ┌────────────┐
                   │ PontoTrajeto │        │   Ponto    │
                   │ (junction)   │        │ (id_ponto) │
                   └──────────────┘        └────────────┘
```

---

# 6. Documentação da API

## Base URL

```
http://localhost:3000
```

## Headers Padrão

```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>  (quando necessário)
```

## Resposta Padrão

### Sucesso (200/201)
```json
{
  "success": true,
  "data": { /* dados */ },
  "message": "Operação realizada com sucesso"
}
```

### Erro
```json
{
  "error": "Descrição do erro",
  "code": "ERROR_CODE",
  "message": "Mensagem detalhada"
}
```

---

## 6.1 Autenticação

### POST `/auth/login`

Autenticar com email e password.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "senha123"
}
```

**Response (200):**
```json
{
  "message": "Login bem-sucedido",
  "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Erros:**
| Código | Erro |
|--------|------|
| 400 | Email e senha são obrigatórios |
| 401 | Credenciais inválidas |
| 403 | Conta bloqueada / Conta não confirmada |

---

### POST `/auth/registo`

Registar novo utilizador.

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "SeNha123!"
}
```

**Response (201):**
```json
{
  "message": "Conta criada com sucesso. Email de confirmação enviado."
}
```

**Erros:**
| Código | Erro |
|--------|------|
| 400 | Email já em uso / Campos obrigatórios em falta |
| 500 | Erro ao enviar email |

---

### GET `/auth/confirm-email?token=xxxxx`

Confirmar conta via token enviado por email.

**Response (200):**
```json
{
  "message": "Conta confirmada com sucesso"
}
```

---

### GET `/auth/me`

Validar token JWT e obter dados do utilizador.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "isAuthorized": true,
  "user": {
    "id_user": 1,
    "name": "João Silva",
    "email": "joao@example.com",
    "role": "Admin"
  }
}
```

**Response (401):** Token inválido ou expirado.

---

## 6.2 Utilizadores

### GET `/user/list`

Listar todos os utilizadores.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id_user": 1,
      "name": "João Silva",
      "email": "joao@example.com",
      "active": true,
      "role": "Admin",
      "created_at": "2026-04-10T08:00:00Z"
    }
  ]
}
```

---

### GET `/user/details/:id_user`

Obter detalhes de um utilizador específico.

**Response (200):**
```json
{
  "id_user": 1,
  "name": "João Silva",
  "email": "joao@example.com",
  "active": true,
  "role": "Admin"
}
```

---

### PATCH `/user/update-role/:id_user`

Atualizar role de um utilizador (deve ser Admin).

**Body:**
```json
{
  "role": "User"
}
```

**Response (200):**
```json
{
  "message": "Role atualizada com sucesso"
}
```

---

### PATCH `/user/block/:id_user`

Bloquear utilizador (impede login).

**Response (200):**
```json
{
  "message": "Utilizador bloqueado com sucesso"
}
```

---

### PATCH `/user/unblock/:id_user`

Desbloquear utilizador.

**Response (200):**
```json
{
  "message": "Utilizador desbloqueado com sucesso"
}
```

---

### DELETE `/user/delete/:id_user`

Eliminar utilizador permanentemente.

**Response (200):**
```json
{
  "message": "Utilizador eliminado com sucesso"
}
```

---

## 6.3 Pontos (Panoramas)

### GET `/ponto/list?page=1&limit=20`

Listar todos os panoramas com paginação.

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20)
- `categoria` (opcional: filtrar por categoria)

**Response (200):**
```json
{
  "data": [
    {
      "id_ponto": 1,
      "name": "Salão Principal",
      "description": "Entrada principal do museu",
      "latitude": 38.7223,
      "longitude": -9.1393,
      "imagePath": "uploads/pontos/ponto_1_thumb.jpg",
      "panoramaShape": "sphere",
      "categorias": [
        { "id_categoria": 1, "name": "Interior" }
      ],
      "created_at": "2026-04-10T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50
  }
}
```

---

### GET `/ponto/:id`

Obter detalhes completos de um ponto (com hotspots e trajectos).

**Response (200):**
```json
{
  "id_ponto": 1,
  "name": "Salão Principal",
  "description": "Entrada principal",
  "latitude": 38.7223,
  "longitude": -9.1393,
  "panoramaShape": "sphere",
  "imagePath": "uploads/pontos/ponto_1_thumb.jpg",
  "hotspots": [
    {
      "id_hotspot": 1,
      "tipo": "texto",
      "conteudo": "Bem-vindo ao museu",
      "x": 0.5,
      "y": 0.5,
      "z": 1.0
    },
    {
      "id_hotspot": 2,
      "tipo": "modelo3d",
      "conteudo": "uploads/modelos3d/escultura.glb",
      "x": 0.3,
      "y": 0.7,
      "z": 0.8
    }
  ],
  "trajetos": [
    {
      "id_trajeto": 1,
      "id_rota": 1,
      "description": "Rota 1: Circuito Completo"
    }
  ],
  "categorias": [
    { "id_categoria": 1, "name": "Interior", "color": "#FF0000" }
  ]
}
```

---

### POST `/ponto/create`

Criar novo panorama (requer autenticação e role de editor).

**Body:**
```json
{
  "name": "Salão Lateral",
  "description": "Sala lateral do museu",
  "latitude": 38.7225,
  "longitude": -9.1395,
  "panoramaShape": "sphere",
  "categorias": [1, 2]
}
```

**Alternativa com imagem:**
```
POST /ponto/create
Content-Type: multipart/form-data

name: Salão Lateral
description: Sala lateral
latitude: 38.7225
longitude: -9.1395
image: <ficheiro>
categorias: [1,2]
```

**Response (201):**
```json
{
  "message": "Ponto criado com sucesso",
  "ponto": { /* dados */ }
}
```

---

### PATCH `/ponto/update/:id_ponto`

Atualizar panorama (apenas criador ou admin).

**Body:**
```json
{
  "name": "Novo Nome",
  "description": "Nova descrição",
  "categorias": [1, 3]
}
```

**Response (200):**
```json
{
  "message": "Ponto atualizado com sucesso"
}
```

---

### DELETE `/ponto/delete/:id_ponto`

Eliminar panorama e todos os seus hotspots.

**Response (200):**
```json
{
  "message": "Ponto eliminado com sucesso"
}
```

---

## 6.4 Hotspots

### GET `/hotspot?id_ponto=1`

Listar hotspots de um ponto específico.

**Query Params:**
- `id_ponto` (obrigatório)

**Response (200):**
```json
[
  {
    "id_hotspot": 1,
    "id_ponto": 1,
    "tipo": "texto",
    "conteudo": "Texto explicativo",
    "x": 0.5,
    "y": 0.5,
    "z": 1.0
  }
]
```

---

### POST `/hotspot/add`

Criar novo hotspot (requer autenticação).

**Body:**
```json
{
  "id_ponto": 1,
  "tipo": "imagem",
  "conteudo": "uploads/media/imagem.jpg",
  "x": 0.6,
  "y": 0.7,
  "z": 0.9
}
```

**Response (201):**
```json
{
  "message": "Hotspot criado com sucesso",
  "hotspot": { /* dados */ }
}
```

---

### PUT `/hotspot/:id`

Atualizar hotspot.

**Body:**
```json
{
  "tipo": "video",
  "conteudo": "uploads/media/video.mp4",
  "x": 0.5,
  "y": 0.6,
  "z": 0.8
}
```

**Response (200):**
```json
{
  "message": "Hotspot atualizado com sucesso"
}
```

---

### DELETE `/hotspot/:id`

Eliminar hotspot.

**Response (200):**
```json
{
  "message": "Hotspot eliminado com sucesso"
}
```

---

## 6.5 Trajetos e Rotas

### GET `/trajeto/list`

Listar todos os trajetos/rotas guiadas.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id_trajeto": 1,
      "id_rota": 1,
      "description": "Rota 1: Circuito Completo",
      "video": "uploads/videos/rota1.mp4",
      "pontos": [
        { "id_ponto": 1, "name": "Salão Principal", "order": 1 },
        { "id_ponto": 2, "name": "Galeria", "order": 2 }
      ]
    }
  ]
}
```

---

### GET `/trajeto/:id`

Obter detalhes de um trajeto com pontos ordenados.

**Response (200):**
```json
{
  "id_trajeto": 1,
  "description": "Rota 1",
  "video": "...",
  "pontos": [
    {
      "id_ponto": 1,
      "name": "Salão Principal",
      "order": 1,
      "hotspots_count": 5
    }
  ]
}
```

---

### POST `/trajeto/create`

Criar novo trajeto (requer autenticação).

**Body:**
```json
{
  "id_rota": 1,
  "description": "Novo Trajeto",
  "pontos": [1, 2, 3],
  "video": "uploads/videos/trajeto.mp4"
}
```

**Response (201):**
```json
{
  "message": "Trajeto criado com sucesso",
  "trajeto": { /* dados */ }
}
```

---

## 6.6 Categorias de Pontos

### GET `/categoria-ponto/list`

Listar todas as categorias disponíveis.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id_categoria": 1,
      "name": "Interior",
      "description": "Ambientes interiores",
      "icon": "building",
      "color": "#FF0000"
    }
  ]
}
```

---

### POST `/categoria-ponto/create`

Criar nova categoria (requer Admin).

**Body:**
```json
{
  "name": "Exterior",
  "description": "Ambientes exteriores",
  "icon": "tree",
  "color": "#00FF00"
}
```

---

## 6.7 Estatísticas

### GET `/estatistica?id_ponto=1&data_inicio=2026-01-01&data_fim=2026-04-23`

Obter estatísticas de visualizações de um ponto.

**Query Params:**
- `id_ponto` (obrigatório)
- `data_inicio` (formato: YYYY-MM-DD)
- `data_fim` (formato: YYYY-MM-DD)

**Response (200):**
```json
{
  "id_ponto": 1,
  "total_visualizacoes": 1250,
  "media_duracao": 180,  // segundos
  "dispositivos": {
    "desktop": 750,
    "mobile": 350,
    "tablet": 150
  },
  "por_dia": [
    {
      "data": "2026-04-20",
      "visualizacoes": 50,
      "duracao_media": 185
    }
  ],
  "localizacoes": [
    {
      "latitude": 38.7223,
      "longitude": -9.1393,
      "freq": 120
    }
  ]
}
```

---

### POST `/estatistica/registar`

Registar visualização (chamada pelo frontend).

**Body:**
```json
{
  "id_ponto": 1,
  "duracao_visualizacao": 240,
  "coordenadas_globais": {
    "latitude": 38.7223,
    "longitude": -9.1393
  }
}
```

---

## 6.8 Logs (Auditoria)

### GET `/log?filtro=DELETE&pagina=1`

Listar logs de auditoria (requer Admin).

**Query Params:**
- `filtro` (CREATE, UPDATE, DELETE, etc.)
- `pagina` (default: 1)
- `id_user` (opcional)

**Response (200):**
```json
{
  "data": [
    {
      "id_log": 1,
      "id_user": 1,
      "acao": "CREATE",
      "tabela_afetada": "hotspots",
      "registro_id": 5,
      "dados_novos": { /* JSON */ },
      "endereco_ip": "192.168.1.100",
      "timestamp": "2026-04-23T14:30:00Z"
    }
  ],
  "total": 500
}
```

---

## 6.9 Media Library

### POST `/media/upload`

Fazer upload de ficheiro (imagem, vídeo, modelo 3D, audio).

**Body:** `multipart/form-data`
```
file: <ficheiro>
tipo: "imagem" | "video" | "modelo3d" | "audio"
destinacao: "pontos" | "media" | "modelos3d"
```

**Response (200):**
```json
{
  "message": "Ficheiro carregado com sucesso",
  "url": "uploads/pontos/ponto_1_imagem.jpg",
  "tamanho": 245000,
  "tipo_mime": "image/jpeg"
}
```

---

### GET `/media/list?tipo=imagem`

Listar ficheiros carregados.

**Query Params:**
- `tipo` (imagem, video, modelo3d, audio)
- `pagina` (default: 1)

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "nome": "ponto_1_imagem.jpg",
      "url": "uploads/pontos/ponto_1_imagem.jpg",
      "tipo": "imagem",
      "tamanho": 245000,
      "uploaded_at": "2026-04-23T10:00:00Z"
    }
  ]
}
```

---

## 6.10 Temas e Personalização

### GET `/theme/list`

Listar presets de temas disponíveis.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id_preset": 1,
      "nome": "Tema Clássico",
      "descricao": "Design tradicional em tons neutros",
      "cores": {
        "primary": "#1f2937",
        "secondary": "#6b7280",
        "accent": "#3b82f6"
      },
      "fontes": {
        "primaria": "Segoe UI",
        "secundaria": "Arial"
      }
    }
  ]
}
```

---

### POST `/theme/create`

Criar novo preset de tema (requer Admin).

**Body:**
```json
{
  "nome": "Tema Moderno",
  "descricao": "Design minimalista",
  "cores": {
    "primary": "#111111",
    "secondary": "#FFFFFF",
    "accent": "#00D9FF"
  }
}
```

---

## 6.11 Map Overlays

### GET `/map-overlay?id_ponto=1`

Listar sobreposições de mapa para um ponto.

**Response (200):**
```json
[
  {
    "id_overlay": 1,
    "tipo": "polygon",
    "coordenadas": { /* GeoJSON */ },
    "cor": "#FF0000",
    "label": "Área do museu"
  }
]
```

---

### POST `/map-overlay/add`

Adicionar sobreposição de mapa.

**Body:**
```json
{
  "id_ponto": 1,
  "tipo": "circle",
  "coordenadas": {
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": [-9.1393, 38.7223]
    }
  },
  "cor": "#00FF00",
  "label": "Entrada"
}
```

---

# 7. Autenticação e Autorização

## Fluxo de Autenticação JWT

```
1. Utilizador faz login
   POST /auth/login { email, password }
   
2. Backend valida credenciais
   ✓ Encontra utilizador
   ✓ Verifica password (bcrypt)
   ✓ Gera JWT com payload { id_user, email, role }
   
3. JWT enviado ao cliente
   Resposta: { authToken: "eyJhbGc..." }
   
4. Cliente armazena JWT (localStorage/sessionStorage)
   
5. Requisições futuras incluem token
   Header: Authorization: Bearer <token>
   
6. Backend valida token
   ✓ Verifica assinatura
   ✓ Verifica expiração
   ✓ Extrai dados do utilizador
   
7. Middleware de autorização
   - requireAuth: verifica token válido
   - requireAdmin: verifica role Admin
   - forbidRoleIds: bloqueia roles específicas
```

## Payload do JWT

```json
{
  "id_user": 1,
  "email": "user@example.com",
  "role": "Admin",
  "id_role": 1,
  "iat": 1682246400,
  "exp": 1682851200
}
```

## Roles e Permissões

### Admin (id_role: 1)
- ✅ Criar, editar, eliminar qualquer conteúdo
- ✅ Gerir utilizadores
- ✅ Aceder a logs e estatísticas
- ✅ Personalizar temas
- ✅ Aceder a todas as rotas

### User (id_role: 2)
- ✅ Criar e editar seu próprio conteúdo
- ✅ Editar pontos e hotspots
- ✅ Visualizar estatísticas
- ❌ Não pode deletar conta
- ❌ Não pode gerir outros utilizadores

### Viewer (id_role: 3)
- ✅ Apenas leitura
- ✅ Visualizar panoramas
- ✅ Navegar hotspots
- ❌ Não pode criar ou editar
- ❌ Perfeito para mobile

## Middleware de Proteção

### requireAuth

Valida token JWT. Se inválido, retorna 401.

```javascript
router.get('/route', requireAuth, controllerFunction);
```

### requireAdmin

Valida token e role Admin. Se não admin, retorna 403.

```javascript
router.delete('/route', requireAdmin, deleteFunction);
```

### forbidRoleIds

Bloqueia determinados roles.

```javascript
const forbidViewer = forbidRoleIds([3], 'Visualizadores não podem editar');
router.patch('/route', forbidViewer, editFunction);
```

---

# 8. WebSocket (Socket.IO)

## Conexão e Eventos

### Client → Server

```javascript
// Conectar ao servidor
const socket = io('http://localhost:3000');

// Enviar evento ao editor (live collaboration)
socket.emit('editor-update', {
  id_ponto: 1,
  propriedade: 'name',
  valor_novo: 'Novo Nome'
});

// Registar visualização
socket.emit('ponto-visualizado', {
  id_ponto: 1,
  duracao: 120,
  timestamp: Date.now()
});
```

### Server → Client (Broadcasting)

```javascript
// Receber atualizações de outros editores
socket.on('editor-update', (data) => {
  console.log('Alguém atualizou:', data);
  // Atualizar UI em tempo real
});

// Notificações em tempo real
socket.on('notificacao', (msg) => {
  console.log('Notificação:', msg);
});
```

## Namespaces Disponíveis

- `/editor` - Colaboração em tempo real entre editores
- `/visor` - Notificações para visualizadores
- `/stats` - Atualizações de estatísticas em tempo real
- `/default` - Eventos gerais

---

# 9. Estratégia para Aplicação Mobile

## Visão Geral

A aplicação mobile é **apenas para leitura** (read-only). O objetivo é sincronizar dados do backend para exibição offline em smartphones e tablets.

### Requisitos

- ✅ Visualizar panoramas 360º
- ✅ Navegar hotspots
- ✅ Seguir trajetos
- ✅ Funcionar offline
- ✅ Sincronização automática quando online
- ❌ Não pode editar conteúdos

---

## 9.1 Arquitetura Recomendada

### Opção 1: API Agregada + SQLite Local (Recomendado)

```
┌──────────────────────────────────────────────────────┐
│             Aplicação Mobile (React Native)          │
├──────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  UI Layer    │  │ State Manager│  │ SQLite DB │  │
│  │  (Screens)   │  │(Redux/Zustand)  │ (Offline) │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└──────────────────────────────────────────────────────┘
           ↓ Sync engines ↑
┌──────────────────────────────────────────────────────┐
│        Backend API (Node.js + Express)               │
├──────────────────────────────────────────────────────┤
│  GET /api/mobile/sync/full                           │
│  GET /api/mobile/sync/delta?lastSync=...             │
│  GET /api/mobile/galeria/:id                         │
│  POST /api/mobile/stats (registar visualizações)     │
└──────────────────────────────────────────────────────┘
```

---

## 9.2 Endpoints Móveis

### GET `/api/mobile/sync/full`

Download completo de todos os dados (primeira sincronização).

**Query Params:**
- `compress` (default: true) - Comprime resposta em gzip
- `formato` (default: json) - Pode ser json ou msgpack

**Response (200):**
```json
{
  "version": "1.0",
  "timestamp": 1682246400,
  "galerias": [
    {
      "id_ponto": 1,
      "name": "Salão Principal",
      "description": "...",
      "imagePath": "...",
      "latitude": 38.7223,
      "longitude": -9.1393,
      "panoramaShape": "sphere",
      "hotspots": [
        {
          "id_hotspot": 1,
          "tipo": "texto",
          "conteudo": "...",
          "x": 0.5,
          "y": 0.5,
          "z": 1.0
        }
      ],
      "categorias": [
        { "id_categoria": 1, "name": "Interior" }
      ],
      "trajetos": [
        { "id_trajeto": 1, "description": "Rota 1" }
      ]
    }
  ],
  "trajetos": [
    {
      "id_trajeto": 1,
      "description": "Rota Completa",
      "pontos": [1, 2, 3]
    }
  ],
  "categorias": [
    { "id_categoria": 1, "name": "Interior", "color": "#FF0000" }
  ]
}
```

**Tamanho esperado:** 50-200 MB (dependendo de quantas imagens)

---

### GET `/api/mobile/sync/delta?lastSync=2026-04-20T10:00:00Z`

Sincronizar apenas mudanças desde última sincronização.

**Response (200):**
```json
{
  "timestamp": 1682505600,
  "changes": {
    "galerias": {
      "created": [
        { "id_ponto": 10, "name": "Nova Galeria", "..." }
      ],
      "updated": [
        { "id_ponto": 1, "name": "Nome Atualizado", "..." }
      ],
      "deleted": [5, 6, 7]
    },
    "hotspots": {
      "created": [...],
      "updated": [...],
      "deleted": [...]
    }
  }
}
```

---

### GET `/api/mobile/galeria/:id`

Obter galeria completa (para precarregar antes de visualizar).

**Response (200):**
```json
{
  "id_ponto": 1,
  "name": "Salão Principal",
  "panorama": {
    "url": "uploads/pontos/ponto_1.jpeg",
    "shape": "sphere",
    "formato": "equirectangular"
  },
  "hotspots": [
    {
      "id_hotspot": 1,
      "tipo": "imagem",
      "url": "uploads/media/img1.jpg",
      "x": 0.5,
      "y": 0.5,
      "z": 1.0,
      "descricao": "Obra de arte"
    }
  ]
}
```

---

### POST `/api/mobile/stats`

Registar visualizações (pode ser batched offline).

**Body:**
```json
{
  "visualizacoes": [
    {
      "id_ponto": 1,
      "duracao": 120,
      "timestamp": 1682246400,
      "coordenadas_globais": {
        "latitude": 38.7223,
        "longitude": -9.1393
      }
    }
  ]
}
```

---

## 9.3 Fluxo de Sincronização

### Primeira Vez (Cold Start)

```
1. App abre
   ↓
2. Verifica SQLite local (vazio)
   ↓
3. Mostra splash screen com barra de progresso
   ↓
4. Faz GET /api/mobile/sync/full (comprimido)
   └─ ~50-200 MB
   ↓
5. Descomprime dados
   ↓
6. Insere em SQLite local
   └─ Tipicamente <1 min no mobile
   ↓
7. Armazena timestamp de sincronização
   ↓
8. Mostra lista de galerias
```

### Sincronizações Futuras (Delta)

```
1. App em background (ou ao iniciar)
   ↓
2. App volta ao foreground ou utilizador toca "Sincronizar"
   ↓
3. Faz GET /api/mobile/sync/delta?lastSync=xxxxx
   └─ Tipicamente <1 MB
   ↓
4. Processa mudanças (INSERT/UPDATE/DELETE em SQLite)
   ↓
5. Atualiza UI se necessário
   ↓
6. Armazena novo timestamp
```

---

## 9.4 Estrutura Local (SQLite)

Esquema que o mobile deve implementar:

```sql
-- Galerias / Pontos
CREATE TABLE pontos (
  id_ponto INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  latitude REAL,
  longitude REAL,
  imagePath TEXT,
  panoramaShape TEXT,
  sync_timestamp INTEGER
);

-- Hotspots
CREATE TABLE hotspots (
  id_hotspot INTEGER PRIMARY KEY,
  id_ponto INTEGER NOT NULL,
  tipo TEXT,
  conteudo TEXT,
  x REAL,
  y REAL,
  z REAL,
  FOREIGN KEY(id_ponto) REFERENCES pontos(id_ponto) ON DELETE CASCADE
);

-- Categorias
CREATE TABLE categorias_ponto (
  id_categoria INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT
);

-- Ponto <-> Categoria (many-to-many)
CREATE TABLE ponto_categoria (
  id_ponto INTEGER,
  id_categoria INTEGER,
  PRIMARY KEY (id_ponto, id_categoria),
  FOREIGN KEY(id_ponto) REFERENCES pontos(id_ponto),
  FOREIGN KEY(id_categoria) REFERENCES categorias_ponto(id_categoria)
);

-- Trajetos
CREATE TABLE trajetos (
  id_trajeto INTEGER PRIMARY KEY,
  description TEXT
);

-- Trajeto <-> Ponto (many-to-many with order)
CREATE TABLE trajeto_pontos (
  id_trajeto INTEGER,
  id_ponto INTEGER,
  order_index INTEGER,
  PRIMARY KEY (id_trajeto, id_ponto),
  FOREIGN KEY(id_trajeto) REFERENCES trajetos(id_trajeto),
  FOREIGN KEY(id_ponto) REFERENCES pontos(id_ponto)
);

-- Sincronização local
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_sync_timestamp INTEGER,
  app_version TEXT
);
```

---

## 9.5 Estratégia de Cache de Imagens

### Estrutura de Pastas no Mobile

```
/data/app/com.galerias360/
├── cache/
│   ├── panoramas/
│   │   ├── ponto_1.jpg
│   │   ├── ponto_2.jpg
│   │   └── ...
│   ├── thumbnails/
│   │   ├── ponto_1_thumb.jpg
│   │   └── ...
│   └── media/
│       ├── hotspot_1.jpg
│       ├── video_1.mp4
│       └── ...
└── database.db  (SQLite)
```

### Políticas de Cache

1. **Panoramas Completos:** 300-500 MB limit
   - LRU (Least Recently Used) eviction
   - Priorizar downloads de wifi

2. **Miniaturas:** 50 MB limit
   - Sempre baixar automaticamente
   - Comprimidas (max 100KB cada)

3. **Hotspots (imagens/vídeos):** 500 MB limit
   - Download on-demand ou pré-carga
   - Permitir deletar manualmente

---

## 9.6 Exemplo de Implementação (React Native)

### Arquivo: `services/SyncService.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import SQLite from 'react-native-sqlite-storage';

const API_URL = 'http://backend-url/api/mobile';
const DB_NAME = 'galerias360.db';

class SyncService {
  private db: SQLite.SQLiteDatabase;

  async initDatabase() {
    this.db = await SQLite.openDatabase({
      name: DB_NAME,
      location: 'default',
    });
    await this.createTables();
  }

  async fullSync() {
    try {
      const isConnected = await NetInfo.isConnected();
      if (!isConnected) {
        throw new Error('Sem conexão de internet');
      }

      // Download completo
      const response = await axios.get(`${API_URL}/sync/full`, {
        params: { compress: true }
      });

      const { galerias, trajetos, categorias } = response.data;

      // Inserir em SQLite
      await this.db.transaction(async (tx) => {
        for (const galeria of galerias) {
          await tx.executeSql(
            `INSERT OR REPLACE INTO pontos 
             (id_ponto, name, description, imagePath, panoramaShape)
             VALUES (?, ?, ?, ?, ?)`,
            [
              galeria.id_ponto,
              galeria.name,
              galeria.description,
              galeria.imagePath,
              galeria.panoramaShape
            ]
          );

          // Inserir hotspots relacionados
          for (const hotspot of galeria.hotspots) {
            await tx.executeSql(
              `INSERT OR REPLACE INTO hotspots 
               (id_hotspot, id_ponto, tipo, conteudo, x, y, z)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                hotspot.id_hotspot,
                hotspot.id_ponto,
                hotspot.tipo,
                hotspot.conteudo,
                hotspot.x,
                hotspot.y,
                hotspot.z
              ]
            );
          }
        }
      });

      // Guardar timestamp
      const timestamp = Date.now();
      await AsyncStorage.setItem('lastSync', String(timestamp));

      return { success: true, itemsSync: galerias.length };
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      throw error;
    }
  }

  async deltaSync() {
    try {
      const lastSync = await AsyncStorage.getItem('lastSync');
      if (!lastSync) {
        return this.fullSync();
      }

      const lastSyncDate = new Date(parseInt(lastSync)).toISOString();
      const response = await axios.get(`${API_URL}/sync/delta`, {
        params: { lastSync: lastSyncDate }
      });

      const { changes } = response.data;

      // Processar mudanças
      await this.db.transaction(async (tx) => {
        // Deletados
        for (const id of changes.galerias.deleted) {
          await tx.executeSql('DELETE FROM pontos WHERE id_ponto = ?', [id]);
        }

        // Atualizados e criados
        for (const galeria of [
          ...changes.galerias.created,
          ...changes.galerias.updated
        ]) {
          await tx.executeSql(
            `INSERT OR REPLACE INTO pontos 
             (id_ponto, name, description, imagePath, panoramaShape)
             VALUES (?, ?, ?, ?, ?)`,
            [
              galeria.id_ponto,
              galeria.name,
              galeria.description,
              galeria.imagePath,
              galeria.panoramaShape
            ]
          );
        }
      });

      const timestamp = Date.now();
      await AsyncStorage.setItem('lastSync', String(timestamp));

      return { success: true, changeCount: Object.keys(changes).length };
    } catch (error) {
      console.error('Erro ao fazer delta sync:', error);
      throw error;
    }
  }

  async getGaleria(id: number) {
    try {
      return await this.db.transaction(async (tx) => {
        const galerias = await tx.executeSql(
          'SELECT * FROM pontos WHERE id_ponto = ?',
          [id]
        );

        const hotspots = await tx.executeSql(
          'SELECT * FROM hotspots WHERE id_ponto = ?',
          [id]
        );

        return {
          ...galerias.rows.item(0),
          hotspots: hotspots.rows.raw()
        };
      });
    } catch (error) {
      console.error('Erro ao obter galeria:', error);
      throw error;
    }
  }

  private async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS pontos (
        id_ponto INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        latitude REAL,
        longitude REAL,
        imagePath TEXT,
        panoramaShape TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS hotspots (
        id_hotspot INTEGER PRIMARY KEY,
        id_ponto INTEGER NOT NULL,
        tipo TEXT,
        conteudo TEXT,
        x REAL,
        y REAL,
        z REAL,
        FOREIGN KEY(id_ponto) REFERENCES pontos(id_ponto)
      )`,
      `CREATE TABLE IF NOT EXISTS categorias_ponto (
        id_categoria INTEGER PRIMARY KEY,
        name TEXT,
        color TEXT,
        icon TEXT
      )`
    ];

    for (const table of tables) {
      await this.db.executeSql(table);
    }
  }
}

export default new SyncService();
```

---

## 9.7 Autenticação para Mobile

Para mobile **viewer-only**, duas opções:

### Opção A: Token Público (Recomendado para Museus)

```javascript
// Backend: Gerar token público
router.post('/auth/public-token', async (req, res) => {
  const token = jwt.sign(
    { 
      role: 'Viewer',
      id_role: 3,
      publicToken: true 
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  res.json({ token, expiresIn: 30 * 24 * 60 * 60 });
});
```

Mobile inclui esse token em cada requisição.

### Opção B: Sem Autenticação (Endpoints Públicos)

```javascript
// Endpoints específicos móveis não requerem token
router.get('/api/mobile/sync/full', (req, res) => {
  // Sem verificação de autenticação
});
```

---

## 9.8 Performance e Otimizações

### Backend

1. **Compressão gzip** (automática com `compression` middleware)
2. **Cache HTTP** com expires longo
3. **Paginação** para dados grandes
4. **Images otimizadas:**
   - Redimensionar panoramas (max 4K)
   - Converter para webp (60% menos tamanho)
   - Qualidade 75-80%

### Mobile

1. **Download apenas quando online**
2. **Executar sync em background**
3. **Lidar com resumable uploads**
4. **Compressão local de imagens**
5. **Lazy loading de hotspots**

---

## 9.9 Exemplo de Resposta Mobile Otimizada

```json
{
  "version": "1.0",
  "timestamp": 1682246400,
  "metadata": {
    "totalSize": "150MB",
    "itemsCount": 45,
    "imagesCount": 230
  },
  "galerias": [
    {
      "id": 1,
      "name": "Salão Principal",
      "images": {
        "thumb": "pontos/1_thumb.webp",  // 50KB
        "panorama": "pontos/1_panorama.webp"  // 2.5MB
      },
      "hotspots": [
        {
          "id": 1,
          "type": "image",
          "image": "media/1_hotspot.webp",  // 300KB
          "coords": [0.5, 0.5, 1.0]
        }
      ]
    }
  ]
}
```

---

# 10. Media Library

## Estrutura de Uploads

```
backend/uploads/
├── pontos/
│   ├── ponto_1_thumb.jpg
│   ├── ponto_1_panorama.jpg
│   ├── ponto_2_thumb.jpg
│   └── ...
├── media/
│   ├── imagem_1.jpg
│   ├── imagem_2.png
│   ├── video_1.mp4
│   └── ...
├── modelos3d/
│   ├── escultura.glb
│   ├── quadro.obj
│   └── ...
├── logos/
│   ├── logo.png
│   └── logo_dark.png
└── editor-state.json
```

## Tipos Suportados

| Tipo | Extensões | Max Size | Notas |
|------|-----------|----------|-------|
| Imagem | jpg, png, webp, gif | 50 MB | Comprimidas, max 4000x3000 |
| Vídeo | mp4, webm, mov | 500 MB | Codec H.264, AAC audio |
| Modelo 3D | glb, gltf, obj, fbx | 100 MB | Otimizado para web |
| Áudio | mp3, wav, ogg | 50 MB | 320kbps recomendado |

## Upload via API

```bash
curl -X POST http://localhost:3000/media/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@imagem.jpg" \
  -F "tipo=imagem" \
  -F "destinacao=pontos"
```

---

# 11. Best Practices

## Segurança

- ✅ Todas as senhas em bcrypt (minimum 10 rounds)
- ✅ JWT com expiração (recomendado 7 dias)
- ✅ HTTPS em produção
- ✅ CORS configurado corretamente
- ✅ Input validation em todas as rotas
- ✅ Rate limiting para endpoints sensíveis
- ✅ Logs de todas as ações críticas

## Performance

- ✅ Índices nas colunas de foreign keys
- ✅ Paginação para listas grandes
- ✅ Cache HTTP apropriado
- ✅ Compressão gzip ativa
- ✅ CDN para ficheiros estáticos (em produção)
- ✅ Connection pooling no BD

## Código

- ✅ Usar controllers para lógica de rotas
- ✅ Services para lógica de negócio reutilizável
- ✅ Validação com schemas (Joi, Yup)
- ✅ Error handling consistente
- ✅ Logging estruturado
- ✅ Documentação de funções complexas

## Base de Dados

- ✅ Backup regular (diário em produção)
- ✅ Migrations versionadas
- ✅ Índices nas colunas de busca
- ✅ Constraints apropriadas (FK, UNIQUE, NOT NULL)
- ✅ Timezone em UTC

---

# 12. Troubleshooting

## Problemas Comuns

### CORS errors

**Sintoma:** "Access to XMLHttpRequest blocked by CORS policy"

**Solução:**
```env
# Backend .env
FRONTEND_URLS=http://localhost:3001,http://192.168.0.106:3001
```

---

### JWT expirado

**Sintoma:** 401 Unauthorized

**Solução:** Implementar refresh token

```javascript
// Gerar refresh token de longa duração
const refreshToken = jwt.sign(
  { id_user, email },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);
```

---

### Base de dados recusa conexão

**Sintoma:** "ECONNREFUSED 127.0.0.1:5432"

**Solução:**
```bash
# Verificar serviço
sudo service postgresql start  # Linux
brew services start postgresql  # macOS
```

---

### Upload de ficheiros falha

**Sintoma:** 413 Payload Too Large

**Solução:**
```javascript
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb' }));
```

---

### Sincronização mobile muito lenta

**Sintoma:** Download de sync/full demora >5 minutos

**Solução:**
1. Implementar compressão (já incluída)
2. Reduzir qualidade de imagens:
```javascript
// Sharp para otimizar
const sharp = require('sharp');
sharp(buffer)
  .resize(2000, 2000, { fit: 'inside' })
  .webp({ quality: 75 })
  .toBuffer()
```

3. Usar CDN para ficheiros grandes

---

## Logs Úteis

### Ver logs em tempo real

```bash
# Backend
tail -f backend.log

# Frontend
npm run dev 2>&1 | tee frontend.log
```

### Verificar BD

```bash
# PostgreSQL
psql -U postgres -d galerias360 -c "SELECT * FROM pontos;"

# MySQL
mysql -u root -p galerias360 -e "SELECT * FROM pontos;"
```

---

## Recursos Adicionais

- [Express.js Documentation](https://expressjs.com/)
- [Sequelize ORM](https://sequelize.org/)
- [JWT.io](https://jwt.io/)
- [Socket.IO Guide](https://socket.io/docs/)
- [Next.js](https://nextjs.org/)
- [React Native SQLite](https://github.com/andpor/react-native-sqlite-storage)

---

# Autores e Contato

**Última atualização:** 23 de Abril de 2026

Para dúvidas ou sugestões, contacte a equipa de desenvolvimento.

---

**Fim da Documentação**
