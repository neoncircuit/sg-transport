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
  /** Bumps on ingest and on each fake-fleet tick (poller snapshots are stable). */
  private revision = 0;

  constructor(staleMs = DEFAULT_STALE_MS) {
    this.staleMs = staleMs;
  }

  getRevision(): number {
    return this.revision;
  }

  ingest(source: string, vehicles: VehiclePosition[], now = Date.now()): void {
    this.sources.set(source, { vehicles, updatedAt: now });
    this.revision += 1;
  }

  /** Fresh poller sources only (within staleMs). */
  activeSources(now = Date.now()): string[] {
    return [...this.sources.entries()]
      .filter(([, snap]) => now - snap.updatedAt < this.staleMs)
      .map(([id]) => id);
  }

  /** Age (ms) of each known source; omitted when never ingested. */
  sourceAges(now = Date.now()): Record<string, number> {
    const ages: Record<string, number> = {};
    for (const [id, snap] of this.sources) {
      ages[id] = now - snap.updatedAt;
    }
    return ages;
  }

  snapshot(now = Date.now()): VehiclePosition[] {
    const active = [...this.sources.entries()].filter(
      ([, snap]) => now - snap.updatedAt < this.staleMs,
    );

    if (active.length === 0) {
      this.revision += 1;
      return this.fake.tick(now);
    }

    return active.flatMap(([, snap]) => snap.vehicles);
  }

  /**
   * Non-mutating view for /health — does not advance the fake fleet or
   * bump revision.
   */
  peek(now = Date.now()): VehiclePosition[] {
    const active = [...this.sources.entries()].filter(
      ([, snap]) => now - snap.updatedAt < this.staleMs,
    );

    if (active.length === 0) {
      return this.fake.peek(now);
    }

    return active.flatMap(([, snap]) => snap.vehicles);
  }
}
