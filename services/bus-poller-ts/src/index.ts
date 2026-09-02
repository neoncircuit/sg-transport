import { waitForGatewayUrl } from "@sg-transport/ports";
import { collectVehicles } from "./source.js";

const POLL_MS = Number(process.env.POLL_MS ?? 2_000);
const SOURCE_ID = "bus-poller";

async function pushToGateway(
  gatewayUrl: string,
  vehicles: Awaited<ReturnType<typeof collectVehicles>>["vehicles"],
): Promise<void> {
  const res = await fetch(`${gatewayUrl}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: SOURCE_ID, vehicles }),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`ingest ${res.status}: ${text}`);
  }
}

async function main(): Promise<void> {
  console.log(
    `[bus-poller] BUS_SOURCE=${process.env.BUS_SOURCE ?? "auto"} (cascade: lta → fixture → skeleton)`,
  );
  console.log("[bus-poller] waiting for gateway…");
  const gatewayUrl = await waitForGatewayUrl();
  console.log(`[bus-poller] gateway ${gatewayUrl}`);

  async function tick(): Promise<void> {
    const result = await collectVehicles();
    await pushToGateway(gatewayUrl, result.vehicles);
    const note = result.reason ? ` — ${result.reason}` : "";
    console.log(
      `[bus-poller] ${result.mode} → gateway ${result.vehicles.length} buses (${gatewayUrl})${note}`,
    );
  }

  await tick();
  const timer = setInterval(() => {
    void tick().catch((err: unknown) => {
      console.error("[bus-poller] tick failed", err);
    });
  }, POLL_MS);

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
