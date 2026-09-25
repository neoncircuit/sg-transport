import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";
import { SINGAPORE_CENTER } from "./config";

/** Rough island bounds for the static Pages demo fleet. */
const BOUNDS = {
  latMin: 1.25,
  latMax: 1.45,
  lonMin: 103.65,
  lonMax: 104.02,
} as const;

interface DemoVehicle {
  id: string;
  mode: VehicleMode;
  lat: number;
  lon: number;
  bearing: number;
  speed: number;
  lineRef?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function seedFleet(): DemoVehicle[] {
  const [lon0, lat0] = SINGAPORE_CENTER;
  const seeds: Array<{
    id: string;
    mode: VehicleMode;
    lat: number;
    lon: number;
    lineRef?: string;
  }> = [
    {
      id: "demo-bus-1",
      mode: "bus",
      lat: lat0 - 0.04,
      lon: lon0 + 0.03,
      lineRef: "190",
    },
    {
      id: "demo-bus-2",
      mode: "bus",
      lat: lat0 + 0.02,
      lon: lon0 - 0.05,
      lineRef: "36",
    },
    {
      id: "demo-bus-3",
      mode: "bus",
      lat: lat0 - 0.02,
      lon: lon0 - 0.02,
      lineRef: "970",
    },
    { id: "demo-mrt-ns", mode: "mrt", lat: 1.304, lon: 103.832, lineRef: "NSL" },
    { id: "demo-mrt-ew", mode: "mrt", lat: 1.319, lon: 103.843, lineRef: "EWL" },
    { id: "demo-lrt-bp", mode: "lrt", lat: 1.38, lon: 103.763, lineRef: "BPLRT" },
    { id: "demo-plane", mode: "plane", lat: 1.36, lon: 103.99 },
    { id: "demo-ship", mode: "ship", lat: 1.22, lon: 103.85 },
  ];

  return seeds.map((s, i) => ({
    ...s,
    bearing: (i * 45) % 360,
    speed: s.mode === "plane" ? 0.00035 : s.mode === "ship" ? 0.00008 : 0.00012,
  }));
}

/**
 * Client-side drifting fleet for GitHub Pages / offline demos when no
 * gateway is available. Not a substitute for live pollers.
 */
export class DemoFleet {
  private readonly vehicles: DemoVehicle[];

  constructor(seed: DemoVehicle[] = seedFleet()) {
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
      lineRef: v.lineRef,
    }));
  }
}

export function startDemoFleet(
  onTick: (vehicles: VehiclePosition[]) => void,
  intervalMs = 1000,
): () => void {
  const fleet = new DemoFleet();
  onTick(fleet.tick());
  const timer = window.setInterval(() => onTick(fleet.tick()), intervalMs);
  return () => window.clearInterval(timer);
}
