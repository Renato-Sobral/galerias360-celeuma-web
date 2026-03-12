# Galerias 360 — Documentação da API

> **Base URL:** `http://localhost:3000` (ou conforme variável de ambiente `PORT`)

Todas as respostas são em **JSON**. Endpoints que requerem autenticação esperam o header:

```
Authorization: Bearer <token>
```

---

## Índice

- [Autenticação](#autenticação)
- [Utilizadores](#utilizadores)
- [Pontos](#pontos)
- [Categorias de Pontos](#categorias-de-pontos)
- [Trajetos](#trajetos)
- [Hotspots](#hotspots)
- [Estatísticas](#estatísticas)
- [Logs](#logs)
- [Recuperação de Password](#recuperação-de-password)
- [Convites](#convites)
- [Map Overlays](#map-overlays)
- [Temas / Personalização](#temas--personalização)
- [Biblioteca de Media](#biblioteca-de-media)
- [Ficheiros Estáticos](#ficheiros-estáticos)
- [WebSocket (Socket.IO)](#websocket-socketio)

---

## Autenticação

Base path: `/auth`

| Método | Endpoint       | Descrição                              | Auth |
|--------|----------------|----------------------------------------|------|
| POST   | `/auth/login`  | Login de utilizador                    | Não  |
| POST   | `/auth/registo`| Registo de novo utilizador             | Não  |
| GET    | `/auth/confirm-email` | Confirmar conta via token        | Não  |
| GET    | `/auth/me`     | Verificar token / obter dados do user  | Não  |

### POST `/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "senha123"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | `{ message, authToken }` — Login bem-sucedido |
| 400    | Email e senha são obrigatórios |
| 401    | Credenciais inválidas / Senha inválida |
| 403    | Conta bloqueada / Conta não confirmada |
| 500    | Erro no servidor |

### POST `/auth/registo`

> O primeiro utilizador criado recebe automaticamente a role **Admin**; os seguintes recebem **User**.

**Body:**
```json
{
  "name": "Nome",
  "email": "user@example.com",
  "password": "senha123"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Conta criada e email de confirmação enviado |
| 400    | Campos obrigatórios em falta / Email já em uso |
| 500    | Erro no servidor |

### GET `/auth/confirm-email?token=...`

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Conta confirmada com sucesso / Conta já confirmada |
| 400    | Token inválido |
| 401    | Token expirado |
| 404    | Utilizador não encontrado |

### GET `/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | `{ isAuthorized: true, user: { user, name, email, role } }` |
| 401    | Token não fornecido / Token inválido ou expirado |

---

## Utilizadores

Base path: `/user`

| Método | Endpoint                      | Descrição                        | Auth |
|--------|-------------------------------|----------------------------------|------|
| GET    | `/user/list`                  | Listar todos os utilizadores     | —    |
| GET    | `/user/details/:id_user`      | Detalhes de um utilizador        | —    |
| GET    | `/user/roles`                 | Listar todas as roles            | —    |
| PATCH  | `/user/update-role/:id_user`  | Atualizar role de um utilizador  | —    |
| PATCH  | `/user/block/:id_user`        | Bloquear utilizador              | —    |
| PATCH  | `/user/unblock/:id_user`      | Desbloquear utilizador           | —    |
| DELETE | `/user/delete/:id_user`       | Eliminar utilizador              | —    |

### GET `/user/list`

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    {
      "id_user": 1,
      "name": "Nome",
      "email": "...",
      "active": true,
      "Role": { "name": "Admin" }
    }
  ]
}
```

### GET `/user/details/:id_user`

**Resposta 200:**
```json
{
  "name": "Nome",
  "email": "user@example.com"
}
```

### GET `/user/roles`

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    { "id_role": 1, "name": "Admin" },
    { "id_role": 2, "name": "User" }
  ]
}
```

### PATCH `/user/update-role/:id_user`

**Body:**
```json
{
  "role": "Admin"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Role atualizada com sucesso |
| 400    | Role inválida |
| 404    | Utilizador não encontrado |
| 500    | Erro interno |

### PATCH `/user/block/:id_user`

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Utilizador bloqueado com sucesso |
| 404    | Utilizador não encontrado |
| 500    | Erro interno |

### PATCH `/user/unblock/:id_user`

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Utilizador desbloqueado com sucesso |
| 404    | Utilizador não encontrado |
| 500    | Erro interno |

### DELETE `/user/delete/:id_user`

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Utilizador eliminado com sucesso |
| 404    | Utilizador não encontrado |
| 500    | Erro interno |

---

## Pontos

Base path: `/ponto`

> Os pontos suportam **múltiplas categorias** (relação muitos-para-muitos). A imagem pode ser enviada por upload direto ou por referência a um ficheiro da [Biblioteca de Media](#biblioteca-de-media).

| Método | Endpoint                  | Descrição              | Auth |
|--------|---------------------------|------------------------|------|
| POST   | `/ponto/create`           | Criar ponto            | —    |
| GET    | `/ponto/list`             | Listar todos os pontos | —    |
| GET    | `/ponto/:id`              | Obter ponto por ID     | —    |
| PATCH  | `/ponto/update/:id_ponto` | Atualizar ponto        | —    |
| DELETE | `/ponto/delete/:id_ponto` | Eliminar ponto         | —    |

### POST `/ponto/create`

**Content-Type:** `multipart/form-data`

| Campo         | Tipo           | Obrigatório | Descrição                                                    |
|---------------|----------------|-------------|--------------------------------------------------------------|
| name          | string         | Sim         | Nome do ponto                                                |
| description   | string         | Não         | Descrição do ponto                                           |
| latitude      | number         | Sim         | Latitude                                                     |
| longitude     | number         | Sim         | Longitude                                                    |
| id_categorias | number/array   | Sim         | ID(s) da(s) categoria(s) — aceita número, array JSON ou CSV  |
| id_categoria  | number         | Sim*        | Alias legado para `id_categorias` (única categoria)          |
| image         | file           | Não         | Imagem 360° (guardada na biblioteca de media)                |
| imagePath     | string         | Não         | Caminho relativo de um ficheiro existente na biblioteca de media (alternativa ao upload) |
| username      | string         | Não         | Nome do utilizador (para logs)                               |

> *Utilizar `id_categorias` ou `id_categoria` — pelo menos uma categoria é obrigatória.

**Resposta 201:**
```json
{
  "message": "Ponto criado com sucesso",
  "ponto": {
    "id_ponto": 1,
    "name": "...",
    "description": "...",
    "latitude": 40.123,
    "longitude": -8.456,
    "id_categoria": 1,
    "imagePath": "pontos/1234_foto.jpg",
    "imageUrl": "http://.../uploads/pontos/1234_foto.jpg",
    "environment": "http://.../uploads/pontos/1234_foto.jpg",
    "image": null,
    "visualizacoes": 0,
    "categorias": [
      { "id_categoria": 1, "name": "Monumentos" }
    ]
  }
}
```

> Emite evento WebSocket: `novoPonto`

### GET `/ponto/list`

> A listagem **não inclui** o conteúdo binário da imagem (`image`/`iv` são excluídos). Inclui `imageUrl` (URL absoluto) e contagem de visualizações.

**Resposta 200:**
```json
{
  "pontos": [
    {
      "id_ponto": 1,
      "name": "...",
      "description": "...",
      "id_categoria": 1,
      "latitude": 40.123,
      "longitude": -8.456,
      "imagePath": "pontos/1234_foto.jpg",
      "imageUrl": "http://.../uploads/pontos/1234_foto.jpg",
      "environment": "http://.../uploads/pontos/1234_foto.jpg",
      "image": null,
      "visualizacoes": 42,
      "categorias": [
        { "id_categoria": 1, "name": "Monumentos" },
        { "id_categoria": 3, "name": "Praças" }
      ]
    }
  ]
}
```

### GET `/ponto/:id`

> Retorna o ponto com imagem desencriptada (base64) se existir no formato legado, ou `imageUrl` se usar a biblioteca de media. O campo `environment` contém a imagem disponível (URL ou base64).

**Resposta 200:**
```json
{
  "ponto": {
    "id_ponto": 1,
    "name": "...",
    "description": "...",
    "imagePath": "pontos/1234_foto.jpg",
    "imageUrl": "http://.../uploads/pontos/1234_foto.jpg",
    "environment": "http://.../uploads/pontos/1234_foto.jpg",
    "image": "<base64 ou null>",
    "visualizacoes": 0,
    "categorias": [
      { "id_categoria": 1, "name": "Monumentos" }
    ]
  }
}
```

### PATCH `/ponto/update/:id_ponto`

**Content-Type:** `multipart/form-data`

| Campo         | Tipo           | Obrigatório | Descrição                                                    |
|---------------|----------------|-------------|--------------------------------------------------------------|
| name          | string         | Não         | Novo nome                                                    |
| description   | string         | Não         | Nova descrição                                               |
| latitude      | number         | Não         | Nova latitude                                                |
| longitude     | number         | Não         | Nova longitude                                               |
| id_categorias | number/array   | Não         | Nova(s) categoria(s) — aceita número, array JSON ou CSV      |
| id_categoria  | number         | Não         | Alias legado para `id_categorias`                            |
| image         | file           | Não         | Nova imagem 360°                                             |
| imagePath     | string         | Não         | Caminho relativo na biblioteca de media (alternativa ao upload) |

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Ponto atualizado com sucesso |
| 400    | Pelo menos uma categoria é obrigatória / Categoria inválida |
| 404    | Ponto não encontrado |
| 500    | Erro ao atualizar ponto |

### DELETE `/ponto/delete/:id_ponto`

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Ponto eliminado com sucesso |
| 404    | Ponto não encontrado |
| 500    | Erro ao eliminar ponto |

> Emite evento WebSocket: `pontoRemovido`

---

## Categorias de Pontos

Base path: `/categoria`

| Método | Endpoint                           | Descrição                     | Auth  |
|--------|------------------------------------|-------------------------------|-------|
| GET    | `/categoria/list`                  | Listar categorias             | —     |
| GET    | `/categoria/:id_categoria`         | Obter categoria por ID        | —     |
| POST   | `/categoria/create`                | Criar categoria               | Admin |
| PATCH  | `/categoria/update/:id_categoria`  | Atualizar categoria           | Admin |
| DELETE | `/categoria/delete/:id_categoria`  | Eliminar categoria            | Admin |

### GET `/categoria/list`

> Retorna categorias ordenadas alfabeticamente (A-Z).

### POST `/categoria/create` 🔒 Admin

**Body:**
```json
{
  "name": "Monumentos"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Categoria criada com sucesso |
| 400    | Nome obrigatório |
| 409    | Categoria duplicada |
| 500    | Erro ao criar categoria |

### PATCH `/categoria/update/:id_categoria` 🔒 Admin

**Body:**
```json
{
  "name": "Novo Nome"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Categoria atualizada com sucesso |
| 400    | Nome obrigatório |
| 404    | Categoria não encontrada |
| 409    | Categoria duplicada |
| 500    | Erro ao atualizar categoria |

### DELETE `/categoria/delete/:id_categoria` 🔒 Admin

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Categoria eliminada com sucesso |
| 404    | Categoria não encontrada |
| 409    | Categoria com pontos associados (eliminação bloqueada) |
| 500    | Erro ao eliminar categoria |

---

## Trajetos

Base path: `/trajeto`

| Método | Endpoint                             | Descrição                       | Auth |
|--------|--------------------------------------|---------------------------------|------|
| POST   | `/trajeto/create`                    | Criar trajeto                   | —    |
| GET    | `/trajeto/list`                      | Listar trajetos com pontos      | —    |
| POST   | `/trajeto/upload-video/:id`          | Upload de vídeo para trajeto    | —    |
| PATCH  | `/trajeto/update-description/:id`    | Atualizar descrição do trajeto  | —    |
| DELETE | `/trajeto/rota/delete/:id`           | Eliminar rota e seus trajetos   | —    |
| GET    | `/trajeto/video/:id`                 | Obter caminho do vídeo          | —    |

### POST `/trajeto/create`

**Body:**
```json
{
  "pontos": [1, 2, 3],
  "description": "Descrição do trajeto",
  "video": "/uploads/videos/exemplo.mp4"
}
```

> `pontos` deve ter no mínimo 2 IDs de pontos existentes. É criada automaticamente uma **Rota** a partir do primeiro e último ponto.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Trajeto criado com sucesso |
| 400    | Mínimo de 2 pontos é obrigatório |
| 404    | Um ou mais pontos são inválidos |
| 500    | Erro interno |

### GET `/trajeto/list`

**Resposta 200:**
```json
{
  "trajetos": [
    {
      "id_trajeto": 1,
      "description": "...",
      "video": "/uploads/videos/...",
      "Pontos": [ { "id_ponto": 1, "name": "..." } ],
      "Rota": { "id_rota": 1, "name": "A a B" }
    }
  ]
}
```

### POST `/trajeto/upload-video/:id`

**Content-Type:** `multipart/form-data`

| Campo     | Tipo   | Obrigatório | Descrição                                                       |
|-----------|--------|-------------|-----------------------------------------------------------------|
| video     | file   | Não*        | Ficheiro de vídeo                                               |
| videoPath | string | Não*        | Caminho relativo na biblioteca de media (alternativa ao upload) |

> *É obrigatório fornecer `video` (ficheiro) ou `videoPath` (referência).

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | `{ message, videoPath }` |
| 400    | Ficheiro de vídeo não enviado |
| 404    | Trajeto não encontrado |
| 500    | Erro interno |

### PATCH `/trajeto/update-description/:id`

**Body:**
```json
{
  "description": "Nova descrição"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Descrição atualizada com sucesso |
| 404    | Trajeto não encontrado |
| 500    | Erro interno |

### DELETE `/trajeto/rota/delete/:id`

> Elimina a Rota com o ID indicado e, em cascata, os seus Trajetos.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Rota e trajetos apagados com sucesso |
| 404    | Rota não encontrada |
| 500    | Erro interno |

### GET `/trajeto/video/:id`

**Resposta 200:**
```json
{
  "videoPath": "/uploads/videos/1234_video.mp4"
}
```

---

## Hotspots

Base path: `/hotspot`

| Método | Endpoint        | Descrição            | Auth |
|--------|-----------------|----------------------|------|
| POST   | `/hotspot/add`  | Criar hotspot        | —    |
| GET    | `/hotspot/`     | Listar hotspots      | —    |
| PUT    | `/hotspot/:id`  | Atualizar hotspot    | —    |
| DELETE | `/hotspot/:id`  | Eliminar hotspot     | —    |

### POST `/hotspot/add`

**Body:**
```json
{
  "id_ponto": 1,
  "x": 0.5,
  "y": 1.0,
  "z": -0.3
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Hotspot criado com sucesso |
| 400    | Dados incompletos |
| 500    | Erro interno |

### GET `/hotspot/`

**Resposta 200:** Array de hotspots.
```json
[
  { "id_hotspot": 1, "id_ponto": 1, "x": 0.5, "y": 1.0, "z": -0.3, "tipo": null, "conteudo": null }
]
```

### PUT `/hotspot/:id`

**Body:**
```json
{
  "tipo": "texto",
  "conteudo": "Texto ou referência de conteúdo"
}
```

> `tipo` aceita: `"texto"`, `"imagem"`, `"modelo3d"`, `"audio"`, `"audioespacial"`, `"video"`, `"link"`.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Hotspot atualizado com sucesso |
| 400    | Campo `tipo` obrigatório |
| 404    | Hotspot não encontrado |
| 500    | Erro interno |

### DELETE `/hotspot/:id`

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Hotspot eliminado com sucesso |
| 400    | ID não fornecido |
| 404    | Hotspot não encontrado |
| 500    | Erro interno |

---

## Estatísticas

Base path: `/estatistica`

| Método | Endpoint                              | Descrição                              | Auth |
|--------|---------------------------------------|----------------------------------------|------|
| POST   | `/estatistica/`                       | Registar uma visualização              | —    |
| GET    | `/estatistica/resumo`                 | Obter resumo de estatísticas           | —    |
| GET    | `/estatistica/dispositivos`           | Distribuição por dispositivo           | —    |
| GET    | `/estatistica/browsers`               | Distribuição por browser               | —    |
| GET    | `/estatistica/so`                     | Distribuição por sistema operativo     | —    |
| GET    | `/estatistica/timeline`               | Visualizações ao longo do tempo        | —    |
| GET    | `/estatistica/historico`              | Histórico recente de acessos           | —    |
| GET    | `/estatistica/top-pontos`             | Ranking de pontos mais visualizados    | —    |
| GET    | `/estatistica/visualizacoes/:id_ponto`| Visualizações de um ponto específico   | —    |

### POST `/estatistica/`

> O dispositivo, browser e sistema operativo são detetados automaticamente a partir do header `User-Agent`. Clientes móveis, incluindo apps Expo/React Native, podem opcionalmente enviar estes campos explicitamente no body, num objeto `clientInfo`, ou pelos headers `x-device-type`, `x-client-browser` e `x-client-os`.

**Body:**
```json
{
  "tipo": "ponto",
  "referencia_id": 1,
  "dispositivo": "mobile",
  "browser": "Expo Go",
  "sistema_operativo": "iOS"
}
```

**Body alternativo (com `clientInfo`):**
```json
{
  "tipo": "ponto",
  "referencia_id": 1,
  "clientInfo": {
    "deviceType": "mobile",
    "browser": "Expo Go",
    "os": "iOS"
  }
}
```

> `tipo` aceita: `"ponto"` ou `"rota"`. `dispositivo` aceita: `"desktop"`, `"mobile"` ou `"tablet"`.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Visualização registada com sucesso (inclui `dispositivo`, `browser`, `sistema_operativo`) |
| 400    | Campos obrigatórios em falta / Tipo inválido |
| 404    | Ponto ou rota não existe |
| 500    | Erro interno |

### GET `/estatistica/resumo`

**Resposta 200:**
```json
{
  "totalVisualizacoes": 150,
  "totalPontos": 10,
  "totalTrajetos": 5,
  "novosPontos": 2,
  "novosTrajetos": 1,
  "percentagemVisualizacoes": 25,
  "pontoMaisVisto": { "nome": "Praça Central", "total": "42" },
  "rotaMaisVista": { "nome": "Rota Norte", "total": "18" },
  "dispositivos": { "desktop": 90, "mobile": 50, "tablet": 10 }
}
```

### GET `/estatistica/dispositivos`

> **Query params:** `dias` (opcional) — número de dias a considerar.

**Resposta 200:**
```json
{
  "success": true,
  "data": { "desktop": 90, "mobile": 50, "tablet": 10 }
}
```

### GET `/estatistica/browsers`

> **Query params:** `dias` (opcional) — número de dias a considerar. Retorna no máximo 10 browsers.

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    { "browser": "Chrome", "total": 80 },
    { "browser": "Safari", "total": 40 },
    { "browser": "Firefox", "total": 20 }
  ]
}
```

### GET `/estatistica/so`

> **Query params:** `dias` (opcional) — número de dias a considerar. Retorna no máximo 10 sistemas.

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    { "so": "Windows", "total": 60 },
    { "so": "macOS", "total": 40 },
    { "so": "Android", "total": 30 },
    { "so": "iOS", "total": 20 }
  ]
}
```

### GET `/estatistica/timeline`

> **Query params:** `dias` (opcional, default: 30) — número de dias a considerar.

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    { "dia": "2026-03-01", "desktop": 5, "mobile": 3, "tablet": 1, "total": 9 },
    { "dia": "2026-03-02", "desktop": 8, "mobile": 4, "tablet": 0, "total": 12 }
  ]
}
```

### GET `/estatistica/historico`

> **Query params:** `limit` (opcional, default `20`, máximo `100`), `dias` (opcional).

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    {
      "id_visualizacao": 120,
      "tipo": "ponto",
      "referencia_id": 8,
      "referencia_nome": "Praça Central",
      "dispositivo": "mobile",
      "browser": "Expo Go",
      "sistema_operativo": "iOS",
      "data_hora": "2026-03-12T14:32:10.000Z"
    }
  ]
}
```

### GET `/estatistica/top-pontos`

> **Query params:** `limit` (opcional, default: 10), `dias` (opcional) — filtro temporal.

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    { "id_ponto": 1, "nome": "Praça Central", "total": 42 },
    { "id_ponto": 3, "nome": "Miradouro", "total": 28 }
  ]
}
```

### GET `/estatistica/visualizacoes/:id_ponto`

**Resposta 200:**
```json
{
  "id_ponto": "1",
  "nomePonto": "Praça Central",
  "visualizacoes": 42
}
```

---

## Logs

Base path: `/log`

| Método | Endpoint                   | Descrição                      | Auth |
|--------|----------------------------|--------------------------------|------|
| GET    | `/log/logs`                | Listar logs semanais           | —    |
| GET    | `/log/logs/:id`            | Download de um log semanal     | —    |
| GET    | `/log/logs/downloadAll`    | Download de todos os logs (ZIP)| —    |

### GET `/log/logs`

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    { "id_log": 1, "weekStartDate": "2025-01-01", "logFile": "..." }
  ]
}
```

### GET `/log/logs/:id`

> Retorna ficheiro `.txt` para download.

**Headers de resposta:**
- `Content-Type: text/plain`
- `Content-Disposition: attachment; filename="log-YYYY-MM-DD.txt"`

### GET `/log/logs/downloadAll`

> Retorna ficheiro `.zip` com todos os logs.

**Headers de resposta:**
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="logs.zip"`

---

## Recuperação de Password

Base path: `/password`

| Método | Endpoint                       | Descrição                           | Auth |
|--------|--------------------------------|-------------------------------------|------|
| POST   | `/password/recuperarPassword`  | Enviar email de recuperação         | Não  |
| POST   | `/password/redefinirPassword`  | Redefinir password com token        | Não  |

### POST `/password/recuperarPassword`

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Email de recuperação enviado com sucesso |
| 400    | Email é obrigatório |
| 404    | Utilizador não encontrado |
| 500    | Erro no servidor |

### POST `/password/redefinirPassword`

**Body:**
```json
{
  "resetToken": "<jwt_token>",
  "newPassword": "novaSenha123"
}
```

> O `resetToken` é recebido por email e expira em **15 minutos**.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Senha redefinida com sucesso |
| 400    | Token e nova senha são obrigatórios |
| 404    | Utilizador não encontrado |
| 500    | Erro no servidor |

---

## Convites

Base path: `/convite`

| Método | Endpoint            | Descrição                               | Auth |
|--------|---------------------|-----------------------------------------|------|
| POST   | `/convite/user`     | Enviar convite por email                | —    |
| POST   | `/convite/registo`  | Registar utilizador através de convite  | Não  |

### POST `/convite/user`

**Body:**
```json
{
  "email": "convidado@example.com",
  "role": "Admin"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Email de convite enviado com sucesso |
| 400    | Email e role são obrigatórios |
| 409    | Já existe um utilizador com este email |
| 500    | Erro no servidor |

### POST `/convite/registo`

**Body:**
```json
{
  "token": "<jwt_invite_token>",
  "name": "Nome do Utilizador",
  "password": "senha123"
}
```

> O `token` é recebido por email e expira em **24 horas**.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Conta criada com sucesso |
| 400    | Campos obrigatórios em falta / Token inválido |
| 401    | Token expirado |
| 409    | Já existe um utilizador com este email |
| 500    | Erro no servidor |

---

## Map Overlays

Base path: `/overlay`

> Os overlays suportam upload direto de ficheiro ou referência a um ficheiro da [Biblioteca de Media](#biblioteca-de-media) via `mediaPath`.

| Método | Endpoint              | Descrição              | Auth |
|--------|-----------------------|------------------------|------|
| POST   | `/overlay/create`     | Criar overlay          | —    |
| GET    | `/overlay/list`       | Listar overlays        | —    |
| GET    | `/overlay/:id`        | Obter overlay por ID   | —    |
| PATCH  | `/overlay/update/:id` | Atualizar overlay      | —    |
| DELETE | `/overlay/delete/:id` | Eliminar overlay       | —    |

### POST `/overlay/create`

**Content-Type:** `multipart/form-data` (limite de 100 MB)

| Campo     | Tipo   | Obrigatório | Descrição                                                       |
|-----------|--------|-------------|-----------------------------------------------------------------|
| file      | file   | Não*        | Ficheiro (imagem, vídeo ou modelo 3D)                           |
| mediaPath | string | Não*        | Caminho relativo na biblioteca de media (alternativa ao upload) |
| tipo      | string | Sim         | Tipo de overlay: `"imagem"`, `"video"` ou `"modelo3d"`          |
| username  | string | Não         | Nome do utilizador (para logs)                                  |

> *É obrigatório fornecer `file` (ficheiro) ou `mediaPath` (referência). O conteúdo é armazenado em binário na base de dados.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Overlay criado com sucesso |
| 400    | Ficheiro é obrigatório |
| 500    | Erro ao criar overlay |

> Emite evento WebSocket: `novoOverlay`

### GET `/overlay/list`

**Resposta 200:**
```json
{
  "overlays": [
    {
      "id": 1,
      "tipo": "imagem",
      "conteudo": "<base64>",
      "mediaPath": "overlays/mapa.png"
    }
  ]
}
```

### GET `/overlay/:id`

**Resposta 200:**
```json
{
  "overlay": {
    "id": 1,
    "tipo": "imagem",
    "conteudo": "<base64>",
    "mediaPath": "overlays/mapa.png"
  }
}
```

### PATCH `/overlay/update/:id`

**Content-Type:** `multipart/form-data`

| Campo     | Tipo   | Obrigatório | Descrição                                                       |
|-----------|--------|-------------|-----------------------------------------------------------------|
| file      | file   | Não         | Novo ficheiro                                                   |
| mediaPath | string | Não         | Caminho relativo na biblioteca de media (alternativa ao upload) |
| tipo      | string | Não         | Novo tipo                                                       |

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Overlay atualizado com sucesso |
| 404    | Overlay não encontrado |
| 500    | Erro ao atualizar overlay |

### DELETE `/overlay/delete/:id`

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Overlay eliminado com sucesso |
| 404    | Overlay não encontrado |
| 500    | Erro ao eliminar overlay |

> Emite evento WebSocket: `overlayRemovido`

---

## Temas / Personalização

Base path: `/theme`

| Método | Endpoint                  | Descrição                          | Auth  |
|--------|---------------------------|------------------------------------|-------|
| GET    | `/theme/active`           | Obter tema ativo                   | Não   |
| GET    | `/theme/list`             | Listar todos os presets            | Não   |
| GET    | `/theme/landing-content`  | Obter textos da landing page       | Não   |
| GET    | `/theme/favicon`          | Obter favicon do site              | Não   |
| GET    | `/theme/:id`              | Obter preset por ID                | Não   |
| POST   | `/theme/create`           | Criar preset de tema               | Admin |
| PUT    | `/theme/update/:id`       | Atualizar preset                   | Admin |
| DELETE | `/theme/delete/:id`       | Eliminar preset                    | Admin |
| POST   | `/theme/set-active`       | Definir tema ativo                 | Admin |
| POST   | `/theme/landing-content`  | Atualizar textos da landing page   | Admin |
| POST   | `/theme/favicon`          | Atualizar favicon do site          | Admin |

### GET `/theme/active`

> Retorna o preset de tema ativo. Se nenhum estiver definido, retorna o preset por defeito do sistema.

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "id_theme_preset": 1,
    "name": "Escuro",
    "lightVars": { "...": "..." },
    "darkVars": { "...": "..." },
    "logoLightUrl": "http://.../uploads/logos/logo-light.png",
    "logoDarkUrl": "http://.../uploads/logos/logo-dark.png"
  }
}
```

### GET `/theme/list`

**Resposta 200:**
```json
{
  "success": true,
  "data": [ { "id_theme_preset": 1, "name": "...", "..." : "..." } ]
}
```

### GET `/theme/:id`

**Resposta 200:**
```json
{
  "success": true,
  "data": { "id_theme_preset": 1, "name": "...", "..." : "..." }
}
```

### POST `/theme/create` 🔒 Admin

**Content-Type:** `multipart/form-data`

| Campo         | Tipo   | Obrigatório | Descrição                                                             |
|---------------|--------|-------------|-----------------------------------------------------------------------|
| name          | string | Sim         | Nome do preset                                                        |
| lightVars     | string | Não         | Variáveis do tema claro (JSON string)                                 |
| darkVars      | string | Não         | Variáveis do tema escuro (JSON string)                                |
| logoLight     | file   | Não         | Logo para modo claro (.png/.jpg/.svg/.webp, max 5MB)                  |
| logoDark      | file   | Não         | Logo para modo escuro (.png/.jpg/.svg/.webp, max 5MB)                 |
| logoLightPath | string | Não         | Caminho relativo na biblioteca de media (alternativa a upload de logo claro)  |
| logoDarkPath  | string | Não         | Caminho relativo na biblioteca de media (alternativa a upload de logo escuro) |

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Preset criado com sucesso |
| 400    | Nome é obrigatório / Formato inválido |
| 409    | Já existe um preset com esse nome |
| 500    | Erro interno |

### PUT `/theme/update/:id` 🔒 Admin

Mesmos campos que `create` (todos opcionais). Logos anteriores são substituídos ao fornecer novos.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Preset atualizado com sucesso |
| 404    | Preset não encontrado |
| 409    | Já existe um preset com esse nome |
| 500    | Erro interno |

### DELETE `/theme/delete/:id` 🔒 Admin

> Se o preset eliminado era o tema ativo, a configuração é limpa (revertida para valores por defeito).

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Preset eliminado com sucesso |
| 404    | Preset não encontrado |
| 500    | Erro interno |

### POST `/theme/set-active` 🔒 Admin

**Body:**
```json
{
  "presetId": 1
}
```

> Enviar `presetId: null` para reverter para o tema por defeito.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Tema ativo atualizado |
| 404    | Preset não encontrado |
| 500    | Erro interno |

### GET `/theme/landing-content`

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "title": "Explora o mundo com Galerias 360",
    "description": "Descobre pontos turísticos..."
  }
}
```

### POST `/theme/landing-content` 🔒 Admin

**Body:**
```json
{
  "title": "Novo título",
  "description": "Nova descrição"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Conteúdo da homepage atualizado |
| 400    | Título / Descrição obrigatórios |
| 500    | Erro interno |

### GET `/theme/favicon`

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "path": "logos/favicon.ico",
    "url": "http://.../uploads/logos/favicon.ico"
  }
}
```

### POST `/theme/favicon` 🔒 Admin

**Body:**
```json
{
  "faviconPath": "logos/favicon.ico"
}
```

> `faviconPath` é um caminho relativo na biblioteca de media. Enviar `faviconPath: null` ou vazio para remover o favicon personalizado.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Favicon atualizado |
| 500    | Erro interno |

---

## Biblioteca de Media

Base path: `/media`

> Gestor de ficheiros integrado para uploads, organização e reutilização de media (imagens, vídeos, modelos 3D, etc.). Todos os endpoints requerem autenticação.

| Método | Endpoint            | Descrição                                    | Auth |
|--------|---------------------|----------------------------------------------|------|
| GET    | `/media/tree`       | Obter árvore de pastas                       | Sim  |
| GET    | `/media/list`       | Listar ficheiros e pastas de um diretório    | Sim  |
| GET    | `/media/references` | Obter referências a um ficheiro              | Sim  |
| POST   | `/media/folder`     | Criar pasta                                  | Sim  |
| POST   | `/media/move`       | Mover ficheiro ou pasta                      | Sim  |
| POST   | `/media/upload`     | Upload de ficheiros                          | Sim  |
| DELETE | `/media/item`       | Eliminar ficheiro ou pasta                   | Sim  |

### GET `/media/tree`

> Retorna a estrutura de pastas (apenas diretórios) em formato de árvore recursiva.

**Resposta 200:**
```json
{
  "success": true,
  "tree": {
    "name": "uploads",
    "path": "",
    "type": "folder",
    "children": [
      {
        "name": "logos",
        "path": "logos",
        "type": "folder",
        "children": []
      },
      {
        "name": "pontos",
        "path": "pontos",
        "type": "folder",
        "children": []
      }
    ]
  }
}
```

### GET `/media/list`

> **Query params:** `path` (opcional) — caminho relativo da pasta a listar (default: raiz).

**Resposta 200:**
```json
{
  "success": true,
  "path": "pontos",
  "items": [
    {
      "name": "foto.jpg",
      "path": "pontos/foto.jpg",
      "type": "file",
      "extension": ".jpg",
      "size": 1234567,
      "modifiedAt": "2026-03-10T12:00:00.000Z"
    },
    {
      "name": "subpasta",
      "path": "pontos/subpasta",
      "type": "folder",
      "extension": "",
      "size": null,
      "modifiedAt": "2026-03-10T12:00:00.000Z"
    }
  ]
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Lista de itens |
| 404    | Pasta não encontrada |
| 500    | Erro ao listar pasta |

### GET `/media/references`

> Procura todas as referências a um ficheiro na base de dados (trajetos, pontos, overlays, temas, configurações) e no código-fonte.

> **Query params:** `path` (obrigatório) — caminho relativo do ficheiro.

**Resposta 200:**
```json
{
  "success": true,
  "references": [
    {
      "type": "trajeto.video",
      "id": 1,
      "label": "Trajeto #1",
      "details": "/uploads/videos/video.mp4"
    },
    {
      "type": "theme.logoLight",
      "id": 2,
      "label": "Preset Escuro",
      "details": "http://.../uploads/logos/logo.png"
    },
    {
      "type": "code.path",
      "id": "frontend/src/app/page.js:42",
      "label": "frontend/src/app/page.js:42",
      "details": "const img = '/uploads/pontos/foto.jpg';"
    }
  ]
}
```

> Tipos de referência possíveis: `trajeto.video`, `theme.logoLight`, `theme.logoDark`, `app.setting`, `ponto.image`, `overlay.media`, `code.path`, `code.filename`.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Lista de referências |
| 400    | `path` é obrigatório |
| 500    | Erro ao procurar referências |

### POST `/media/folder`

**Body:**
```json
{
  "parentPath": "pontos",
  "name": "nova-pasta"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | `{ success: true, folderPath: "pontos/nova-pasta" }` |
| 400    | Nome da pasta é obrigatório / Nome inválido |
| 409    | Já existe um item com esse nome |
| 500    | Erro ao criar pasta |

### POST `/media/move`

**Body:**
```json
{
  "sourcePath": "pontos/foto.jpg",
  "destinationPath": "pontos/subpasta"
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | `{ success: true, path: "pontos/subpasta/foto.jpg" }` |
| 400    | `sourcePath` obrigatório / Não é possível mover pasta para dentro dela própria |
| 404    | Item de origem ou pasta de destino não encontrado |
| 500    | Erro ao mover item |

### POST `/media/upload`

**Content-Type:** `multipart/form-data`

| Campo           | Tipo   | Obrigatório | Descrição                                          |
|-----------------|--------|-------------|---------------------------------------------------|
| files           | file[] | Sim         | Até 50 ficheiros, máximo 250 MB cada               |
| destinationPath | string | Não         | Pasta de destino (default: raiz dos uploads)       |

> Se já existir um ficheiro com o mesmo nome, é adicionado um sufixo numérico automático (ex: `foto (1).jpg`).

**Resposta 201:**
```json
{
  "success": true,
  "files": [
    {
      "name": "foto.jpg",
      "originalName": "foto.jpg",
      "size": 1234567,
      "mimeType": "image/jpeg",
      "path": "pontos/foto.jpg",
      "url": "/uploads/pontos/foto.jpg"
    }
  ]
}
```

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Upload bem-sucedido |
| 400    | Nenhum ficheiro enviado |
| 413    | Ficheiro demasiado grande (limite 250MB por ficheiro) |
| 500    | Erro ao fazer upload |

### DELETE `/media/item`

**Body ou Query params:**
```json
{
  "targetPath": "pontos/foto.jpg"
}
```

> Também aceita `?path=pontos/foto.jpg` como query param. Pastas são eliminadas recursivamente.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Item eliminado com sucesso |
| 400    | `targetPath` é obrigatório |
| 404    | Item não encontrado |
| 500    | Erro ao apagar item |

---

## Ficheiros Estáticos

| Rota             | Descrição                                            |
|------------------|------------------------------------------------------|
| `/uploads/*`     | Todos os ficheiros da biblioteca de media            |

Servidos como ficheiros estáticos via `express.static`. A rota `/uploads` serve ficheiros de múltiplos diretórios de uploads (primário e legado).

---

## WebSocket (Socket.IO)

A aplicação utiliza **Socket.IO** para comunicação em tempo real.

**Configuração:** websocket + polling, ping a cada 25s, timeout de 60s.

### Eventos emitidos pelo servidor

| Evento           | Quando é emitido                 | Payload                     |
|------------------|----------------------------------|-----------------------------|
| `novoPonto`      | Novo ponto criado                | `{ message: "..." }`       |
| `pontoRemovido`  | Ponto eliminado                  | `{ message: "..." }`       |
| `novoOverlay`    | Novo overlay de mapa criado      | `{ message: "..." }`       |
| `overlayRemovido`| Overlay de mapa eliminado        | `{ message: "..." }`       |

### Eventos de conexão

| Evento        | Descrição                   |
|---------------|-----------------------------|
| `connection`  | Cliente conectado           |
| `disconnect`  | Cliente desconectado        |

---

## Middleware de Autenticação

A aplicação disponibiliza dois middlewares em `middleware/auth.js`:

| Middleware     | Descrição                                                              |
|----------------|------------------------------------------------------------------------|
| `requireAuth`  | Valida o token JWT no header `Authorization` e popula `req.auth`       |
| `requireAdmin` | Executa `requireAuth` + verifica se `req.auth.role === 'Admin'`         |

**Estrutura do token JWT (`req.auth`):**
```json
{
  "user": 1,
  "name": "Nome",
  "email": "user@example.com",
  "role": "Admin",
  "iat": 1234567890,
  "exp": 1234654290
}
```

> O token expira em **24 horas**.

---

## Variáveis de Ambiente

| Variável            | Descrição                                                              |
|---------------------|------------------------------------------------------------------------|
| `PORT`              | Porta do servidor (default: `3000`)                                    |
| `JWT_SECRET`        | Chave secreta para assinar tokens JWT                                  |
| `ENCRYPTION_KEY`    | Chave para encriptar imagens dos pontos (AES-256). Obrigatória em produção |
| `FRONTEND_URL`      | URL do frontend (usado em emails)                                      |
| `FRONTEND_URLS`     | URLs permitidas no CORS (separadas por vírgula)                        |
| `BACKEND_URL`       | URL pública do backend (para gerar URLs de logos e media)              |
| `DB_HOST`           | Host da base de dados MySQL (default: `localhost`)                     |
| `DB_USER`           | Utilizador da base de dados                                            |
| `DB_PASSWORD`       | Password da base de dados                                              |
| `DB_NAME`           | Nome da base de dados                                                  |
| `MJ_APIKEY_PUBLIC`  | Chave pública do Mailjet                                               |
| `MJ_APIKEY_PRIVATE` | Chave privada do Mailjet                                               |
| `MAIL_FROM_EMAIL`   | Email de envio (remetente do Mailjet)                                  |
| `MAIL_FROM_NAME`    | Nome do remetente (default: `Galerias 360`)                            |
| `NODE_ENV`          | Ambiente (`production` / `development`)                                |
