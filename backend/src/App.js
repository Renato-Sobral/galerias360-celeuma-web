const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./models/associations");
const http = require("http");
const { Server } = require("socket.io");
const sequelize = require("./models/database");
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const pontoRoutes = require('./routes/pontoRoutes');
const logRoutes = require('./routes/logRoutes');
const hotspotRoutes = require('./routes/hotspotRoutes');
const trajetoRoutes = require('./routes/trajetoRoutes');
const estatisticaRoutes = require('./routes/estatisticaRoutes');
const passwordRoutes = require('./routes/recuperarPasswordRoutes');
const conviteRoutes = require('./routes/conviteRoutes');
const mapOverlayRoutes = require('./routes/mapOverlayRoutes');
const themeRoutes = require('./routes/themeRoutes');
const categoriaPontoRoutes = require('./routes/categoriaPontoRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const editorStateRoutes = require('./routes/editorStateRoutes');
const mobileRoutes = require('./routes/mobileRoutes');
const { PRIMARY_UPLOADS_ROOT, LEGACY_UPLOADS_ROOT } = require('./utils/mediaLibrary');
const { seedDefaultThemePresets } = require('./services/themePresetDefaults');
//const estatistica = require('./models/estatistica');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const { initializeSocket } = require("./models/socket");

const io = initializeSocket(server);
global.io = io;

const getAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const allowedOrigins = getAllowedOrigins();
const isDev = process.env.NODE_ENV !== "production";
const devLocalOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
const devPrivateOriginRegex = /^https?:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}):\d+$/;

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requisições sem origem (mobile apps, WebViews, scripts locais)
    if (!origin || origin === "null" || origin === "undefined") {
      return callback(null, true);
    }

    // Verificar se a origem está na lista permitida
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Em desenvolvimento, permitir localhost e IPs privados
    if (isDev && (devLocalOriginRegex.test(origin) || devPrivateOriginRegex.test(origin))) {
      return callback(null, true);
    }

    // Log para debug
    console.warn(`CORS: Requisição bloqueada de origem: ${origin}`);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/ponto', pontoRoutes);
app.use('/log', logRoutes);
app.use('/trajeto', trajetoRoutes);
app.use('/hotspot', hotspotRoutes);
app.use('/uploads', express.static(PRIMARY_UPLOADS_ROOT));
app.use('/uploads', express.static(LEGACY_UPLOADS_ROOT));
app.use('/estatistica', estatisticaRoutes);
app.use('/password', passwordRoutes);
app.use('/convite', conviteRoutes);
app.use('/overlay', mapOverlayRoutes);
app.use('/theme', themeRoutes);
app.use('/categoria', categoriaPontoRoutes);
app.use('/media', mediaRoutes);
app.use('/editor', editorStateRoutes);
app.use('/mobile', mobileRoutes);

io.on("connection", (socket) => {
  console.log(`🔗 Cliente conectado: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

async function bootstrap() {
  const shouldAlterSchema = process.env.SEQUELIZE_SYNC_ALTER === "true";
  await sequelize.sync(shouldAlterSchema ? { alter: true } : undefined);
  console.log(`✅ Tabelas sincronizadas com sucesso! (alter=${shouldAlterSchema})`);

  await seedDefaultThemePresets();

  server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Erro ao iniciar servidor:", err);
  process.exit(1);
});
