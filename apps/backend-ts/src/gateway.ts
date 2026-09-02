import { createServer, type Server } from "node:http";
import type {
  VehiclePosition,
  VehicleSnapshotMessage,
} from "@sg-transport/shared-types";
import { findFreePort } from "@sg-transport/ports";
import { WebSocketServer, type WebSocket } from "ws";
import { VehicleStore } from "./vehicle-store.js";

export interface GatewayOptions {
  staleMs?: number;
  tickMs?: number;
  /** From git describe / APP_VERSION — shown on /health. */
  version?: string;
  gitSha?: string;
}

export interface Gateway {
  server: Server;
  store: VehicleStore;
  /** Bound port after listen (0 → ephemeral). */
  port: number;
  close: () => Promise<void>;
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isVehiclePosition(value: unknown): value is VehiclePosition {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.mode === "string" &&
    typeof v.lat === "number" &&
    typeof v.lon === "number" &&
    typeof v.observedAt === "number" &&
    typeof v.isInferred === "boolean"
  );
}

/**
 * HTTP + WebSocket gateway: /health, POST /ingest, /ws snapshots.
 * Extracted so tests can bind an ephemeral port without side-effect imports.
 */
export function createGateway(options: GatewayOptions = {}): {
  listen: (port?: number) => Promise<Gateway>;
} {
  const staleMs = options.staleMs ?? Number(process.env.INGEST_STALE_MS ?? 30_000);
  const tickMs = options.tickMs ?? Number(process.env.TICK_MS ?? 1000);
  const version = options.version ?? process.env.APP_VERSION?.trim() ?? "0.0.0-dev";
  const gitSha = options.gitSha ?? process.env.GIT_SHA?.trim() ?? "unknown";
  const store = new VehicleStore(staleMs);
  const clients = new Set<WebSocket>();

  function snapshot(): VehicleSnapshotMessage {
    return {
      type: "snapshot",
      sentAt: Date.now(),
      vehicles: store.snapshot(),
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

  async function handleIngest(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ): Promise<void> {
    const raw = await readBody(req);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "invalid JSON" }));
      return;
    }

    if (typeof body !== "object" || body === null) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "expected object body" }));
      return;
    }

    const { source, vehicles } = body as Record<string, unknown>;
    if (typeof source !== "string" || source.length === 0) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "source string required" }));
      return;
    }
    if (!Array.isArray(vehicles) || !vehicles.every(isVehiclePosition)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "vehicles must be VehiclePosition[]" }));
      return;
    }

    store.ingest(source, vehicles);
    res.writeHead(204);
    res.end();
  }

  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          version,
          gitSha,
          clients: clients.size,
          phase: "2-skeleton",
          sources: store.activeSources(),
        }),
      );
      return;
    }

    if (req.url === "/ingest" && req.method === "POST") {
      void handleIngest(req, res).catch((err: unknown) => {
        console.error("[backend-ts] ingest failed", err);
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "ingest failed" }));
      });
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

  let tickTimer: ReturnType<typeof setInterval> | undefined;

  return {
    async listen(port = 0): Promise<Gateway> {
      return await new Promise<Gateway>((resolve, reject) => {
        const onError = (err: Error) => {
          reject(err);
        };
        server.once("error", onError);
        server.listen(port, "127.0.0.1", () => {
          server.off("error", onError);
          const address = server.address();
          if (!address || typeof address === "string") {
            reject(new Error("expected TCP address"));
            return;
          }
          tickTimer = setInterval(() => {
            broadcast(snapshot());
          }, tickMs);

          resolve({
            server,
            store,
            port: address.port,
            close: () =>
              new Promise((res, rej) => {
                if (tickTimer) clearInterval(tickTimer);
                for (const client of clients) client.close();
                wss.close();
                server.close((err) => (err ? rej(err) : res()));
              }),
          });
        });
      });
    },
  };
}

/**
 * Bind the preferred port, or the next free ports if it is taken.
 * Prefer this over `listen(port)` for local `pnpm dev`.
 */
export async function listenGateway(
  options: GatewayOptions & {
    preferredPort?: number;
    maxAttempts?: number;
  } = {},
): Promise<Gateway> {
  const preferred = options.preferredPort ?? 8787;
  const maxAttempts = options.maxAttempts ?? 20;

  if (preferred === 0) {
    return createGateway(options).listen(0);
  }

  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    const port = await findFreePort(preferred + i, maxAttempts - i);
    try {
      if (port !== preferred) {
        console.warn(
          `[backend-ts] port ${preferred} in use, binding ${port}…`,
        );
      }
      return await createGateway(options).listen(port);
    } catch (err) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "EADDRINUSE") throw err;
      console.warn(
        `[backend-ts] port ${port} raced busy, trying another…`,
      );
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`could not bind gateway near port ${preferred}`);
}
