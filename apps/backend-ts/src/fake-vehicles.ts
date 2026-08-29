import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";

/** Rough Singapore island bounds for Phase 0 fake traffic. */
const BOUNDS = {
  latMin: 1.25,
  latMax: 1.45,
  lonMin: 103.65,
  lonMax: 104.02,
} as const;

interface SimulatedVehicle {
  id: string;
  mode: VehicleMode;
  lat: number;
  lon: number;
  bearing: number;
  /** Degrees of lat/lon drift per tick (scaled inside tick). */
  speed: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function seedFleet(): SimulatedVehicle[] {
  const seeds: Array<{ id: string; mode: VehicleMode; lat: number; lon: number }> = [
    { id: "bus-demo-1", mode: "bus", lat: 1.3005, lon: 103.855 },
    { id: "bus-demo-2", mode: "bus", lat: 1.3521, lon: 103.8198 },
    { id: "bus-demo-3", mode: "bus", lat: 1.334, lon: 103.742 },
    { id: "mrt-demo-ns", mode: "mrt", lat: 1.304, lon: 103.832 },
    { id: "mrt-demo-ew", mode: "mrt", lat: 1.319, lon: 103.843 },
    { id: "lrt-demo-bp", mode: "lrt", lat: 1.38, lon: 103.763 },
    { id: "plane-demo-changi", mode: "plane", lat: 1.36, lon: 103.99 },
    { id: "ship-demo-strait", mode: "ship", lat: 1.22, lon: 103.85 },
  ];

  return seeds.map((s, i) => ({
    ...s,
    bearing: (i * 45) % 360,
    speed: s.mode === "plane" ? 0.00035 : s.mode === "ship" ? 0.00008 : 0.00012,
  }));
}

/**
 * In-memory fake fleet for Phase 0. Positions drift and bounce inside
 * Singapore bounds so the map has something to animate before real pollers exist.
 */
export class FakeVehicleStore {
  private readonly vehicles: SimulatedVehicle[];

  constructor(seed: SimulatedVehicle[] = seedFleet()) {
    this.vehicles = seed;
  }

  tick(now = Date.now()): VehiclePosition[] {
    for (const v of this.vehicles) {
      const rad = (v.bearing * Math.PI) / 180;
      let nextLat = v.lat + Math.cos(rad) * v.speed;
      let nextLon = v.lon + Math.sin(rad) * v.speed;

      if (nextLat < BOUNDS.latMin || nextLat > BOUNDS.latMax) {
        v.bearing = (180 - v.bearing + 360) % 360;
        nextLat = clamp(nextLat, BOUNDS.latMin, BOUNDS.latMax);
      }
      if (nextLon < BOUNDS.lonMin || nextLon > BOUNDS.lonMax) {
        v.bearing = (360 - v.bearing) % 360;
        nextLon = clamp(nextLon, BOUNDS.lonMin, BOUNDS.lonMax);
      }

      v.lat = nextLat;
      v.lon = nextLon;
      // Gentle heading wander so motion isn't perfectly linear.
      v.bearing = (v.bearing + (Math.random() - 0.5) * 8 + 360) % 360;
    }

    return this.vehicles.map((v) => ({
      id: v.id,
      mode: v.mode,
      lat: v.lat,
      lon: v.lon,
      bearing: v.bearing,
      observedAt: now,
      isInferred: true,
    }));
  }
}
