import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureCollection } from "geojson";
import type { VehiclePosition } from "@sg-transport/shared-types";
import { waitForGatewayUrl } from "@sg-transport/ports";
import {
  railLinesFromGeoJSON,
  seedTrains,
  tickTrains,
} from "./simulate.js";

const POLL_MS = Number(process.env.POLL_MS ?? 1_000);
const SOURCE_ID = "mrt-poller";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RAIL = path.resolve(
  here,
  "../../../packages/geometry-ts/data/rail.geojson",
);

async function loadRail(): Promise<FeatureCollection> {
  const file = process.env.RAIL_GEOJSON?.trim() || DEFAULT_RAIL;
  const raw = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
  console.log(`[mrt-poller] rail geometry ← ${file}`);
  return raw;
}

async function pushToGateway(
  gatewayUrl: string,
  vehicles: VehiclePosition[],
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
  const fc = await loadRail();
  const lines = railLinesFromGeoJSON(fc);
  if (lines.length === 0) {
    throw new Error("no LineString features in rail GeoJSON — run extract:rail");
  }
  const trains = seedTrains(lines);
  console.log(`[mrt-poller] waiting for gateway…`);
  const gatewayUrl = await waitForGatewayUrl();
  console.log(
    `[mrt-poller] simulating ${trains.length} trains on ${lines.length} lines → ${gatewayUrl}`,
  );

  let last = Date.now();
  async function tick(): Promise<void> {
    const now = Date.now();
    const dt = Math.min(5, (now - last) / 1000);
    last = now;
    const vehicles = tickTrains(trains, dt, now);
    await pushToGateway(gatewayUrl, vehicles);
    console.log(`[mrt-poller] → gateway ${vehicles.length} trains`);
  }

  await tick();
  const timer = setInterval(() => {
    void tick().catch((err: unknown) => {
      console.error("[mrt-poller] tick failed", err);
    });
  }, POLL_MS);

  function shutdown(signal: string): void {
    console.log(`[mrt-poller] ${signal} received, shutting down`);
    clearInterval(timer);
    process.exit(0);
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main().catch((err: unknown) => {
  console.error("[mrt-poller] fatal", err);
  process.exit(1);
});
