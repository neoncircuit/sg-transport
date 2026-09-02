import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";
import { defineConfig, type Plugin } from "vite";

function findRepoRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));

function gatewayHttpTarget(): string {
  const file =
    process.env.GATEWAY_PORT_FILE?.trim() ||
    path.join(repoRoot, ".local", "gateway.port");
  try {
    const port = Number(readFileSync(file, "utf8").trim());
    if (Number.isFinite(port) && port > 0) {
      return `http://127.0.0.1:${port}`;
    }
  } catch {
    // backend may not have written the file yet
  }
  const preferred = Number(process.env.PORT ?? process.env.GATEWAY_PORT ?? 8787);
  return `http://127.0.0.1:${Number.isFinite(preferred) ? preferred : 8787}`;
}

/** Proxy /ws and /health to whatever port backend-ts actually bound. */
function gatewayProxyPlugin(): Plugin {
  const proxy = httpProxy.createProxyServer({ ws: true, xfwd: true });
  proxy.on("error", (err, _req, res) => {
    console.warn(`[vite] gateway proxy: ${err.message}`);
    if (res && "writeHead" in res && typeof res.writeHead === "function") {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end("gateway unavailable");
    }
  });

  return {
    name: "sg-gateway-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (
          req.url?.startsWith("/health") ||
          req.url?.startsWith("/ingest")
        ) {
          proxy.web(req, res, { target: gatewayHttpTarget() });
          return;
        }
        next();
      });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (req.url?.startsWith("/ws")) {
          proxy.ws(req, socket, head, { target: gatewayHttpTarget() });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [gatewayProxyPlugin()],
  server: {
    port: 5173,
    // If 5173 is taken, try 5174, 5175, … (Vite default; set explicitly).
    strictPort: false,
  },
});
