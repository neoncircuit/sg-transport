import type { VehiclePosition } from "@sg-transport/shared-types";

interface SkeletonBus {
  id: string;
  lat: number;
  lon: number;
  bearing: number;
  speed: number;
}

/** A handful of buses drifting around Singapore so the ingest path is visible. */
function seed(): SkeletonBus[] {
  return [
    {
      id: "skel-bus-orchard",
      lat: 1.3048,
      lon: 103.8318,
      bearing: 40,
      speed: 0.00014,
    },
    {
      id: "skel-bus-tampines",
      lat: 1.354,
      lon: 103.943,
      bearing: 200,
      speed: 0.00012,
    },
    {
      id: "skel-bus-jurong",
      lat: 1.3329,
      lon: 103.7436,
      bearing: 95,
      speed: 0.00013,
    },
    {
      id: "skel-bus-woodlands",
      lat: 1.436,
      lon: 103.786,
      bearing: 160,
      speed: 0.00011,
    },
  ];
}

const BOUNDS = {
  latMin: 1.25,
  latMax: 1.45,
  lonMin: 103.65,
  lonMax: 104.02,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Local stand-in for LTA DataMall until an account key is issued.
 * Produces the same VehiclePosition contract the live normalizer will emit.
 */
export class SkeletonBusSource {
  private readonly fleet: SkeletonBus[];

  constructor(fleet: SkeletonBus[] = seed()) {
    this.fleet = fleet;
  }

  tick(now = Date.now()): VehiclePosition[] {
    for (const v of this.fleet) {
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
      v.bearing = (v.bearing + (Math.random() - 0.5) * 6 + 360) % 360;
    }

    return this.fleet.map((v) => ({
      id: v.id,
      mode: "bus" as const,
      lat: v.lat,
      lon: v.lon,
      bearing: v.bearing,
      observedAt: now,
      isInferred: true,
    }));
  }
}
