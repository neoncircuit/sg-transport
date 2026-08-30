import type { VehiclePosition } from "@sg-transport/shared-types";
import { FakeVehicleStore } from "./fake-vehicles.js";

const DEFAULT_STALE_MS = 30_000;

interface SourceSnapshot {
  vehicles: VehiclePosition[];
  updatedAt: number;
}

/**
 * Gateway state store: fake Phase 0 fleet by default, overlaid by poller
 * ingest snapshots. When `bus-poller` is fresh, its buses replace fake buses
 * so the map can run the Phase 2 skeleton without a DataMall key.
 */
export class VehicleStore {
  private readonly fake = new FakeVehicleStore();
  private readonly sources = new Map<string, SourceSnapshot>();
  private readonly staleMs: number;

  constructor(staleMs = DEFAULT_STALE_MS) {
    this.staleMs = staleMs;
  }

  ingest(source: string, vehicles: VehiclePosition[], now = Date.now()): void {
    this.sources.set(source, { vehicles, updatedAt: now });
  }

  /** Fresh poller sources only (within staleMs). */
  activeSources(now = Date.now()): string[] {
    return [...this.sources.entries()]
      .filter(([, snap]) => now - snap.updatedAt < this.staleMs)
      .map(([id]) => id);
  }

  snapshot(now = Date.now()): VehiclePosition[] {
    const active = [...this.sources.entries()].filter(
      ([, snap]) => now - snap.updatedAt < this.staleMs,
    );

    if (active.length === 0) {
      return this.fake.tick(now);
    }

    const busPollerLive = active.some(([id]) => id === "bus-poller");
    let base = this.fake.tick(now);
    if (busPollerLive) {
      base = base.filter((v) => v.mode !== "bus");
    }

    const overlay = active.flatMap(([, snap]) => snap.vehicles);
    return [...base, ...overlay];
  }
}
