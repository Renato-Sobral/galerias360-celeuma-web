const { Server } = require("socket.io");

function initializeSocket(server) {
  if (!server) {
    console.error("❌ Servidor não está definido para WebSocket!");
    return;
  }

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", (reason) => {
      console.log(`❌ Cliente desconectado: ${socket.id} - Motivo: ${reason}`);
    });

    socket.on("error", (err) => {
      console.error("❌ Erro no WebSocket:", err.message);
    });
  });

  console.log("✅ WebSocket inicializado!");
  return io;
}

module.exports = { initializeSocket };
