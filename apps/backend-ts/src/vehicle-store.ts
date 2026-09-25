import type { VehiclePosition } from "@sg-transport/shared-types";
import { FakeVehicleStore } from "./fake-vehicles.js";

const DEFAULT_STALE_MS = 30_000;

interface SourceSnapshot {
  vehicles: VehiclePosition[];
  updatedAt: number;
}

/**
 * Gateway state store: fake Phase 0 fleet when nothing is ingested.
 * While any poller is fresh, **only** those overlays are shown — no leftover
 * fake buses/trains drifting into the sea beside real AIS/ADS-B.
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

    return active.flatMap(([, snap]) => snap.vehicles);
  }
}
