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
- [Ficheiros Estáticos](#ficheiros-estáticos)
- [WebSocket (Socket.IO)](#websocket-socketio)

---

## Autenticação

Base path: `/auth`

| Método | Endpoint       | Descrição                              | Auth |
|--------|----------------|----------------------------------------|------|
| POST   | `/auth/login`  | Login de utilizador                    | Não  |
| POST   | `/auth/registo`| Registo de novo utilizador             | Não  |
| GET    | `/auth/me`     | Verificar token / obter dados do user  | Sim  |

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

| Método | Endpoint                  | Descrição              | Auth |
|--------|---------------------------|------------------------|------|
| POST   | `/ponto/create`           | Criar ponto            | —    |
| GET    | `/ponto/list`             | Listar todos os pontos | —    |
| GET    | `/ponto/:id`              | Obter ponto por ID     | —    |
| PATCH  | `/ponto/update/:id_ponto` | Atualizar ponto        | —    |
| DELETE | `/ponto/delete/:id_ponto` | Eliminar ponto         | —    |

### POST `/ponto/create`

**Content-Type:** `multipart/form-data`

| Campo       | Tipo   | Obrigatório | Descrição                      |
|-------------|--------|-------------|--------------------------------|
| name        | string | Sim         | Nome do ponto                  |
| description | string | Não         | Descrição do ponto             |
| latitude    | number | Sim         | Latitude                       |
| longitude   | number | Sim         | Longitude                      |
| id_categoria| number | Sim         | ID da categoria do ponto       |
| image       | file   | Não         | Imagem 360° (encriptada no servidor) |
| username    | string | Não         | Nome do utilizador (para logs) |

**Resposta 201:**
```json
{
  "message": "Ponto criado com sucesso",
  "ponto": { "id_ponto": 1, "name": "...", "..." : "..." }
}
```

> Emite evento WebSocket: `novoPonto`

### GET `/ponto/list`

**Resposta 200:**
```json
{
  "pontos": [
    {
      "id_ponto": 1,
      "name": "...",
      "description": "...",
      "id_categoria": 1,
      "CategoriaPonto": { "id_categoria": 1, "name": "Monumentos" },
      "latitude": 40.123,
      "longitude": -8.456,
      "image": "<base64>"
    }
  ]
}
```

### GET `/ponto/:id`

**Resposta 200:**
```json
{
  "ponto": {
    "id_ponto": 1,
    "name": "...",
    "image": "<base64>"
  }
}
```

### PATCH `/ponto/update/:id_ponto`

**Content-Type:** `multipart/form-data`

| Campo       | Tipo   | Obrigatório | Descrição         |
|-------------|--------|-------------|-------------------|
| name        | string | Não         | Novo nome         |
| description | string | Não         | Nova descrição    |
| latitude    | number | Não         | Nova latitude     |
| longitude   | number | Não         | Nova longitude    |
| id_categoria| number | Não         | Nova categoria    |
| image       | file   | Não         | Nova imagem 360°  |

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Ponto atualizado com sucesso |
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

| Método | Endpoint                           | Descrição                     | Auth |
|--------|------------------------------------|-------------------------------|------|
| GET    | `/categoria/list`                  | Listar categorias             | —    |
| GET    | `/categoria/:id_categoria`         | Obter categoria por ID        | —    |
| POST   | `/categoria/create`                | Criar categoria               | Admin |
| PATCH  | `/categoria/update/:id_categoria`  | Atualizar categoria           | Admin |
| DELETE | `/categoria/delete/:id_categoria`  | Eliminar categoria            | Admin |

### POST `/categoria/create`

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

### DELETE `/categoria/delete/:id_categoria`

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

| Campo | Tipo | Obrigatório | Descrição          |
|-------|------|-------------|--------------------|
| video | file | Sim         | Ficheiro de vídeo  |

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
  "tipo": "info",
  "conteudo": "Texto ou referência de conteúdo"
}
```

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
| GET    | `/estatistica/top-pontos`             | Ranking de pontos mais visualizados    | —    |
| GET    | `/estatistica/visualizacoes/:id_ponto`| Visualizações de um ponto específico   | —    |

### POST `/estatistica/`

> O dispositivo, browser e sistema operativo são detetados automaticamente a partir do header `User-Agent`.

**Body:**
```json
{
  "tipo": "ponto",
  "referencia_id": 1
}
```

> `tipo` aceita: `"ponto"` ou `"rota"`.

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

| Método | Endpoint              | Descrição              | Auth |
|--------|-----------------------|------------------------|------|
| POST   | `/overlay/create`     | Criar overlay          | —    |
| GET    | `/overlay/list`       | Listar overlays        | —    |
| GET    | `/overlay/:id`        | Obter overlay por ID   | —    |
| PATCH  | `/overlay/update/:id` | Atualizar overlay      | —    |
| DELETE | `/overlay/delete/:id` | Eliminar overlay       | —    |

### POST `/overlay/create`

**Content-Type:** `multipart/form-data` (limite de 100 MB)

| Campo    | Tipo   | Obrigatório | Descrição                              |
|----------|--------|-------------|----------------------------------------|
| file     | file   | Sim         | Ficheiro (imagem, vídeo ou modelo 3D)  |
| tipo     | string | Não         | Tipo de overlay                        |
| username | string | Não         | Nome do utilizador (para logs)         |

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
      "id_map_overlay": 1,
      "tipo": "imagem",
      "conteudo": "<base64>"
    }
  ]
}
```

### GET `/overlay/:id`

**Resposta 200:**
```json
{
  "overlay": {
    "id_map_overlay": 1,
    "tipo": "imagem",
    "conteudo": "<base64>"
  }
}
```

### PATCH `/overlay/update/:id`

**Content-Type:** `multipart/form-data`

| Campo | Tipo   | Obrigatório | Descrição         |
|-------|--------|-------------|-------------------|
| file  | file   | Não         | Novo ficheiro     |
| tipo  | string | Não         | Novo tipo         |

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
| GET    | `/theme/:id`              | Obter preset por ID                | Não   |
| POST   | `/theme/create`           | Criar preset de tema               | Admin |
| PUT    | `/theme/update/:id`       | Atualizar preset                   | Admin |
| DELETE | `/theme/delete/:id`       | Eliminar preset                    | Admin |
| POST   | `/theme/set-active`       | Definir tema ativo                 | Admin |
| POST   | `/theme/landing-content`  | Atualizar textos da landing page   | Admin |

### GET `/theme/active`

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

> Retorna `data: null` se nenhum tema estiver ativo (usar defaults).

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

| Campo     | Tipo   | Obrigatório | Descrição                              |
|-----------|--------|-------------|----------------------------------------|
| name      | string | Sim         | Nome do preset                         |
| lightVars | string | Não         | Variáveis do tema claro (JSON string)  |
| darkVars  | string | Não         | Variáveis do tema escuro (JSON string) |
| logoLight | file   | Não         | Logo para modo claro (.png/.jpg/.svg/.webp, max 5MB) |
| logoDark  | file   | Não         | Logo para modo escuro (.png/.jpg/.svg/.webp, max 5MB) |

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 201    | Preset criado com sucesso |
| 400    | Nome é obrigatório / Formato inválido |
| 409    | Já existe um preset com esse nome |
| 500    | Erro interno |

### PUT `/theme/update/:id` 🔒 Admin

Mesmos campos que `create` (todos opcionais). Logos anteriores são removidos ao carregar novos.

**Respostas:**
| Código | Descrição |
|--------|-----------|
| 200    | Preset atualizado com sucesso |
| 404    | Preset não encontrado |
| 409    | Já existe um preset com esse nome |
| 500    | Erro interno |

### DELETE `/theme/delete/:id` 🔒 Admin

> Se o preset eliminado era o tema ativo, a configuração é limpa (revertida para values por defeito).

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

---

## Ficheiros Estáticos

| Rota                  | Descrição                                |
|-----------------------|------------------------------------------|
| `/uploads/logos/*`    | Logos dos temas                          |
| `/uploads/videos/*`  | Vídeos dos trajetos                      |

Servidos como ficheiros estáticos via `express.static`.

---

## WebSocket (Socket.IO)

A aplicação utiliza **Socket.IO** para comunicação em tempo real.

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

| Variável         | Descrição                                         |
|------------------|---------------------------------------------------|
| `PORT`           | Porta do servidor (default: `3000`)               |
| `JWT_SECRET`     | Chave secreta para assinar tokens JWT             |
| `ENCRYPTION_KEY` | Chave para encriptar imagens dos pontos (AES-256) |
| `FRONTEND_URL`   | URL do frontend (usado em emails)                 |
| `FRONTEND_URLS`  | URLs permitidas no CORS (separadas por vírgula)   |
| `BACKEND_URL`    | URL pública do backend (para gerar URLs de logos) |
| `MJ_APIKEY_PUBLIC`  | Chave pública do Mailjet                       |
| `MJ_APIKEY_PRIVATE` | Chave privada do Mailjet                       |
| `NODE_ENV`       | Ambiente (`production` / `development`)           |
