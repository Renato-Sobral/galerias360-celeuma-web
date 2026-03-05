const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./models/associations");
const path = require('path');
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
const devLocalOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (isDev && devLocalOriginRegex.test(origin)) {
      return callback(null, true);
    }
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
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/estatistica', estatisticaRoutes);
app.use('/password', passwordRoutes);
app.use('/convite', conviteRoutes);
app.use('/overlay', mapOverlayRoutes);
app.use('/theme', themeRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

io.on("connection", (socket) => {
  console.log(`🔗 Cliente conectado: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

sequelize.sync({ force: false })
  .then(() => console.log("✅ Tabelas sincronizadas com sucesso!"))
  .catch(err => console.error("❌ Erro ao sincronizar tabelas:", err));


server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
