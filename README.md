# Galerias 360

**Plataforma de gestão e visualização de conteúdos interativos em 360º**, com separação entre backend (API) e frontend (interface).

---

## 📁 Estrutura do Projeto
```
galerias360/
├── backend # API REST (Node.js + Express)
└── frontend # Interface Web (React + Next.js)
```
---

## 🚀 Como Iniciar o Projeto

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-username/galerias360.git
cd galerias360
```

### 2. Configuração do backend
```bash
cd backend
npm install --force
```

### Criar um ficheiro .env dentro da pasta backend com o seguinte conteúdo:
```bash
DB_NAME=nome_da_base_de_dados
DB_USER=utilizador_da_base_de_dados
DB_PASSWORD=palavra_passe_da_base_de_dados
JWT_SECRET=chave_jwt_secreta
ENCRYPTION_KEY=chave_encriptacao_aleatoria
MJ_APIKEY_PUBLIC=chave_publica_mailjet
MJ_APIKEY_PRIVATE=chave_privada_mailjet
FRONTEND_URL=url_do_frontend
```

### Iniciar o backend
```bash
npm run dev
```

### 3. Configuração do frontend
```bash
cd ../frontend
npm install --force
```

### Criar um ficheiro .env dentro da pasta frontend com o seguinte conteúdo:
```bash
JWT_SECRET=mesma_chave_do_backend
NEXT_PUBLIC_API_URL=url_do_backend
```
### Iniciar o frontend:
```bash
npm run dev
```

---

### 🧪 Tecnologias Utilizadas  
Backend: Node.js, Express, JWT, Mailjet  
Frontend: Next.js, Tailwind CSS  
Base de Dados: PostgreSQL

### 🔐 Notas Importantes  
Nunca partilhar os ficheiros .env publicamente.  
Certifica-te que as chaves (JWT_SECRET, ENCRYPTION_KEY, etc.) são seguras e únicas por ambiente.

