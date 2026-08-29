import type { VehiclePosition } from "@sg-transport/shared-types";

/**
 * Phase 0 stub — proves the poller service can build, run in Docker, and
 * speak the VehiclePosition contract. Real LTA DataMall polling arrives in
 * Phase 2; until then this only heartbeats an empty fleet.
 */
const INTERVAL_MS = Number(process.env.HEARTBEAT_MS ?? 10_000);

function emptyFleet(): VehiclePosition[] {
  return [];
}

function heartbeat(): void {
  const vehicles = emptyFleet();
  console.log(
    `[bus-poller] stub heartbeat — ${vehicles.length} vehicles (Phase 2 will poll LTA)`,
  );
}

heartbeat();
const timer = setInterval(heartbeat, INTERVAL_MS);

function shutdown(signal: string): void {
  console.log(`[bus-poller] ${signal} received, shutting down`);
  clearInterval(timer);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
