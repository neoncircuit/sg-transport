import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const DEFAULT_GATEWAY_PORT = 8787;
const DEFAULT_ATTEMPTS = 20;

/** Walk up from a start path until `pnpm-workspace.yaml` is found. */
export function findRepoRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

export function localDir(repoRoot = findRepoRoot()): string {
  return path.join(repoRoot, ".local");
}

export function gatewayPortFile(repoRoot = findRepoRoot()): string {
  return (
    process.env.GATEWAY_PORT_FILE?.trim() ||
    path.join(localDir(repoRoot), "gateway.port")
  );
}

export function preferredGatewayPort(): number {
  const raw = process.env.PORT ?? process.env.GATEWAY_PORT;
  const n = raw !== undefined ? Number(raw) : DEFAULT_GATEWAY_PORT;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_GATEWAY_PORT;
}

/** True if the port cannot be bound (already taken). */
export function isPortTaken(
  port: number,
  host = "127.0.0.1",
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createServer();
    socket.once("error", () => resolve(true));
    socket.once("listening", () => {
      socket.close(() => resolve(false));
    });
    socket.listen(port, host);
  });
}

/**
 * First free TCP port at or above `preferred`.
 * `preferred = 0` asks the OS for an ephemeral free port.
 */
export async function findFreePort(
  preferred = preferredGatewayPort(),
  maxAttempts = DEFAULT_ATTEMPTS,
  host = "127.0.0.1",
): Promise<number> {
  if (preferred === 0) {
    return new Promise((resolve, reject) => {
      const socket = createServer();
      socket.once("error", reject);
      socket.listen(0, host, () => {
        const addr = socket.address();
        socket.close(() => {
          if (!addr || typeof addr === "string") {
            reject(new Error("expected TCP address"));
            return;
          }
          resolve(addr.port);
        });
      });
    });
  }

  for (let i = 0; i < maxAttempts; i++) {
    const port = preferred + i;
    if (!(await isPortTaken(port, host))) return port;
  }
  throw new Error(
    `no free port in ${preferred}…${preferred + maxAttempts - 1}`,
  );
}

export async function writeGatewayPort(
  port: number,
  repoRoot = findRepoRoot(),
): Promise<string> {
  const file = gatewayPortFile(repoRoot);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${port}\n`, "utf8");
  return file;
}

export async function readGatewayPort(
  repoRoot = findRepoRoot(),
): Promise<number | null> {
  try {
    const raw = (await readFile(gatewayPortFile(repoRoot), "utf8")).trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Sync read for Vite config (null until backend writes the file). */
export function readGatewayPortSync(repoRoot = findRepoRoot()): number | null {
  try {
    const raw = readFileSync(gatewayPortFile(repoRoot), "utf8").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function healthOk(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve gateway base URL for pollers.
 * Uses `GATEWAY_URL` if set; else waits for `.local/gateway.port` and/or
 * probes preferred…preferred+N until `/health` succeeds.
 */
export async function waitForGatewayUrl(options?: {
  timeoutMs?: number;
  preferred?: number;
  repoRoot?: string;
}): Promise<string> {
  const explicit = process.env.GATEWAY_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const timeoutMs = options?.timeoutMs ?? 30_000;
  const preferred = options?.preferred ?? preferredGatewayPort();
  const repoRoot = options?.repoRoot ?? findRepoRoot();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const fromFile = await readGatewayPort(repoRoot);
    if (fromFile !== null) {
      const base = `http://127.0.0.1:${fromFile}`;
      if (await healthOk(base)) return base;
    }

    for (let i = 0; i < DEFAULT_ATTEMPTS; i++) {
      const base = `http://127.0.0.1:${preferred + i}`;
      if (await healthOk(base)) return base;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  throw new Error(
    `gateway not reachable within ${timeoutMs}ms (set GATEWAY_URL or start backend-ts)`,
  );
}
