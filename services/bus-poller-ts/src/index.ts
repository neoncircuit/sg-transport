import { loadRepoEnv } from "./env.js";
import { waitForGatewayUrl } from "@sg-transport/ports";
import { ARRIVAL_UPDATE_MS } from "./lta.js";
import { collectVehicles } from "./source.js";

loadRepoEnv();

const SOURCE_ID = "bus-poller";

function pollIntervalMs(): number {
  const raw = process.env.POLL_MS;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Match DataMall Arrival cadence when using live / auto-with-key.
  if (process.env.LTA_ACCOUNT_KEY?.trim()) return ARRIVAL_UPDATE_MS;
  return 2_000;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function pushToGateway(
  gatewayUrl: string,
  vehicles: Awaited<ReturnType<typeof collectVehicles>>["vehicles"],
): Promise<void> {
  const body = JSON.stringify({ source: SOURCE_ID, vehicles });
  const attempts = 3;
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${gatewayUrl}/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          connection: "close",
        },
        body,
        // Avoid keep-alive sockets that WSL/Windows sometimes reset mid-body.
        keepalive: false,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => "");
        throw new Error(`ingest ${res.status}: ${text}`);
      }
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[bus-poller] ingest attempt ${i + 1}/${attempts} failed (${msg})`,
      );
      await sleep(250 * (i + 1));
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`ingest failed after ${attempts} attempts`);
}

async function main(): Promise<void> {
  const pollMs = pollIntervalMs();
  console.log(
    `[bus-poller] BUS_SOURCE=${process.env.BUS_SOURCE ?? "auto"} (cascade: lta → fixture → skeleton)`,
  );
  if (process.env.LTA_ACCOUNT_KEY?.trim()) {
    console.log(
      `[bus-poller] LTA_ACCOUNT_KEY present — poll every ${pollMs}ms (Arrival ~20s)`,
    );
  }
  if (process.env.NODE_EXTRA_CA_CERTS) {
    console.log(
      `[bus-poller] NODE_EXTRA_CA_CERTS=${process.env.NODE_EXTRA_CA_CERTS}`,
    );
  }
  console.log("[bus-poller] waiting for gateway…");
  const gatewayUrl = await waitForGatewayUrl();
  console.log(`[bus-poller] gateway ${gatewayUrl}`);

  async function tick(): Promise<void> {
    const result = await collectVehicles();
    await pushToGateway(gatewayUrl, result.vehicles);
    const note = result.reason ? ` — ${result.reason}` : "";
    const polled =
      result.stopsPolled !== undefined ? ` · ${result.stopsPolled} stops` : "";
    console.log(
      `[bus-poller] ${result.mode} → gateway ${result.vehicles.length} buses${polled} (${gatewayUrl})${note}`,
    );
  }

  // Never exit on a single bad tick — `--watch` would sit idle until a file change.
  void tick().catch((err: unknown) => {
    console.error("[bus-poller] tick failed", err);
  });

  const timer = setInterval(() => {
    void tick().catch((err: unknown) => {
      console.error("[bus-poller] tick failed", err);
    });
  }, pollMs);

  function shutdown(signal: string): void {
    console.log(`[bus-poller] ${signal} received, shutting down`);
    clearInterval(timer);
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main().catch((err: unknown) => {
  console.error("[bus-poller] fatal", err);
  process.exit(1);
});
