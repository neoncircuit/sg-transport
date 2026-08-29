import { createServer } from "node:http";
import type { VehicleSnapshotMessage } from "@sg-transport/shared-types";
import { WebSocketServer, type WebSocket } from "ws";
import { FakeVehicleStore } from "./fake-vehicles.js";

const PORT = Number(process.env.PORT ?? 8787);
const TICK_MS = Number(process.env.TICK_MS ?? 1000);

const store = new FakeVehicleStore();
const clients = new Set<WebSocket>();

function snapshot(): VehicleSnapshotMessage {
  return {
    type: "snapshot",
    sentAt: Date.now(),
    vehicles: store.tick(),
  };
}

function broadcast(msg: VehicleSnapshotMessage): void {
  const raw = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(raw);
    }
  }
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        clients: clients.size,
        phase: "0-fake",
      }),
    );
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify(snapshot()));
  socket.on("close", () => {
    clients.delete(socket);
  });
});

setInterval(() => {
  broadcast(snapshot());
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`[backend-ts] health http://localhost:${PORT}/health`);
  console.log(`[backend-ts] websocket ws://localhost:${PORT}/ws`);
});
