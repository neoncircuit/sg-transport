import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";
import { FakeVehicleStore } from "./fake-vehicles.js";

const DEFAULT_STALE_MS = 30_000;

/** Modes a poller source owns (replaces matching fake vehicles while fresh). */
const SOURCE_MODES: Record<string, VehicleMode[]> = {
  "bus-poller": ["bus"],
  "mrt-poller": ["mrt", "lrt"],
};

interface SourceSnapshot {
  vehicles: VehiclePosition[];
  updatedAt: number;
}

/**
 * Gateway state store: fake Phase 0 fleet by default, overlaid by poller
 * ingest snapshots. Fresh pollers replace fake vehicles for their modes.
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

    const suppressed = new Set<VehicleMode>();
    for (const [id] of active) {
      for (const mode of SOURCE_MODES[id] ?? []) {
        suppressed.add(mode);
      }
    }

    let base = this.fake.tick(now);
    if (suppressed.size > 0) {
      base = base.filter((v) => !suppressed.has(v.mode));
    }

    const overlay = active.flatMap(([, snap]) => snap.vehicles);
    return [...base, ...overlay];
  }
}
