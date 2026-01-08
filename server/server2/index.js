import "dotenv/config";

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { AccessToken } from "livekit-server-sdk";

// =======================
// Express app (API)
// =======================
const app = express();

// ✅ CORS (en prod lo mejor es poner tu dominio en ALLOWED_ORIGIN)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// ✅ Parseo JSON
app.use(express.json({ limit: "1mb" }));

// ✅ Health check
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "Server is running",
    endpoints: {
      livekitTokenPOST: "/livekit-token",
    },
  });
});

// ✅ Si alguien abre /livekit-token en navegador
app.get("/livekit-token", (_req, res) => {
  res.status(405).json({
    error: "Usa POST con JSON",
    example: {
      method: "POST",
      url: "http://localhost:7000/livekit-token",
      body: { roomId: "sala-prueba", identity: "juan" },
    },
  });
});

// ✅ Endpoint token LiveKit (ARREGLADO)
app.post("/livekit-token", async (req, res) => {
  const { roomId, identity } = req.body || {};

  if (!roomId || !identity) {
    return res.status(400).json({ error: "roomId e identity son requeridos" });
  }

  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(500).json({
      error:
        "Faltan variables de entorno: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET",
    });
  }

  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: "2h",
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return res.json({ token, url: LIVEKIT_URL });
  } catch (e) {
    console.error("Token error:", e);
    return res.status(500).json({ error: "No se pudo generar token" });
  }
});

// =======================
// HTTP server + Socket.io (opcional)
// =======================
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGIN },
});

let users = {};

io.on("connection", (socket) => {
  console.log(`🔗 Nuevo socket conectado: ${socket.id}`);

  socket.on("login", (data) => {
    if (!data?.name) return socket.emit("error", "Nombre requerido");
    socket.username = data.name;
    users[data.name] = socket.id;

    socket.emit("login", { success: true });
    io.emit("userlist", Object.keys(users));
  });

  socket.on("join_room", (roomName) => {
    if (!roomName) return;
    socket.join(roomName);

    socket.to(roomName).emit("new_user", {
      id: socket.id,
      name: socket.username,
    });
  });

  socket.on("call_user", (data) => {
    const targetId = users[data?.to];
    if (targetId) {
      io.to(targetId).emit("incoming_call", {
        from: socket.id,
        name: socket.username,
      });
    } else {
      socket.emit("error", "Usuario no encontrado");
    }
  });

  socket.on("call_accepted", (data) => {
    if (data?.to) io.to(data.to).emit("call_accepted", { from: socket.id });
  });

  socket.on("signal", (data) => {
    if (data?.to) {
      io.to(data.to).emit("signal_received", {
        from: socket.id,
        signal: data.signal,
      });
    }
  });

  socket.on("room_chat", (data) => {
    if (!data?.room) return;
    io.to(data.room).emit("room_chat", {
      from: socket.username,
      message: data.message,
    });
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete users[socket.username];
      io.emit("userlist", Object.keys(users));
    }
  });
});

// =======================
// Start server
// =======================
const PORT = process.env.PORT || 7000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 LiveKit token endpoint: POST /livekit-token`);
  console.log(`🧪 Health: GET /`);
});
