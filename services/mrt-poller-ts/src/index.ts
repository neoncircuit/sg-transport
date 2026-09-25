import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForGatewayUrl } from "@sg-transport/ports";
import type { VehiclePosition } from "@sg-transport/shared-types";
import type { FeatureCollection } from "geojson";
import { loadGtfsScheduleOverlay } from "./load-gtfs-overlay.js";
import { gtfsScheduleOverlay, lineSchedule, scheduleLabel } from "./schedule.js";
import {
  isRailServiceWindow,
  isRefInService,
  railServiceWindowLabel,
} from "./service-hours.js";
import { railLinesFromGeoJSON, seedTrains, tickTrains } from "./simulate.js";

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
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const ingestToken = process.env.INGEST_TOKEN?.trim();
  if (ingestToken) headers.authorization = `Bearer ${ingestToken}`;
  const res = await fetch(`${gatewayUrl}/ingest`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: SOURCE_ID, vehicles }),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`ingest ${res.status}: ${text}`);
  }
}

async function main(): Promise<void> {
  await loadGtfsScheduleOverlay();
  const fc = await loadRail();
  const lines = railLinesFromGeoJSON(fc);
  if (lines.length === 0) {
    throw new Error("no LineString features in rail GeoJSON — run extract:rail");
  }
  const trains = seedTrains(lines);
  const refs = [...new Set(lines.map((l) => l.ref))].sort();
  console.log(`[mrt-poller] waiting for gateway…`);
  const gatewayUrl = await waitForGatewayUrl();
  console.log(
    `[mrt-poller] simulating ${trains.length} trains on ${lines.length} features (${refs.length} lines) → ${gatewayUrl}`,
  );
  console.log(`[mrt-poller] ${railServiceWindowLabel()}`);
  const overlay = gtfsScheduleOverlay();
  if (overlay) {
    console.log(`[mrt-poller] schedule source=gtfs overlay (${overlay.fetchedAt})`);
  } else {
    console.log(
      "[mrt-poller] schedule source=builtin (run pnpm --filter @sg-transport/mrt-poller fetch:gtfs for community GTFS)",
    );
  }
  for (const ref of refs.slice(0, 8)) {
    const row = lineSchedule(ref);
    console.log(
      `[mrt-poller]   ${scheduleLabel(row)}${row.source ? ` [${row.source}]` : ""}`,
    );
  }
  if (refs.length > 8) {
    console.log(`[mrt-poller]   … +${refs.length - 8} more lines`);
  }

  let last = Date.now();
  let lastInService: boolean | undefined;
  async function tick(): Promise<void> {
    const now = Date.now();
    const dt = Math.min(5, (now - last) / 1000);
    last = now;
    const networkOpen = isRailServiceWindow(new Date(now));
    if (lastInService !== networkOpen) {
      console.log(
        networkOpen
          ? "[mrt-poller] within service hours — publishing simulated trains"
          : "[mrt-poller] outside service hours — clearing trains (network shut)",
      );
      lastInService = networkOpen;
    }
    const stepped = tickTrains(trains, dt, now);
    const vehicles = networkOpen
      ? stepped.filter((v) => isRefInService(v.lineRef ?? "", new Date(now)))
      : [];
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
