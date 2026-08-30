import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureCollection } from "geojson";
import type { VehiclePosition } from "@sg-transport/shared-types";
import {
  hasArrivalFixtures,
  vehiclesFromArrivalFixtures,
} from "./fixture.js";
import { SkeletonBusSource } from "./skeleton.js";
import { linesFromGeoJSON, snapVehiclesToRoutes } from "./snap.js";

/** How we obtained the fleet for this tick. */
export type SourceMode = "lta" | "fixture" | "skeleton";

const skeleton = new SkeletonBusSource();
const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BUS_GEOJSON = path.resolve(
  here,
  "../../../packages/geometry-ts/data/bus.geojson",
);

let cachedRoutes: FeatureCollection | null | undefined;

async function loadBusRoutes(): Promise<FeatureCollection | null> {
  if (cachedRoutes !== undefined) return cachedRoutes;
  const file = process.env.BUS_GEOJSON?.trim() || DEFAULT_BUS_GEOJSON;
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
    cachedRoutes = linesFromGeoJSON(raw);
    return cachedRoutes;
  } catch {
    cachedRoutes = null;
    return null;
  }
}

async function maybeSnap(
  vehicles: VehiclePosition[],
): Promise<VehiclePosition[]> {
  if (process.env.BUS_SNAP === "0") return vehicles;
  const routes = await loadBusRoutes();
  if (!routes || routes.features.length === 0) return vehicles;
  return snapVehiclesToRoutes(vehicles, routes);
}

function hasLtaKey(): boolean {
  return Boolean(process.env.LTA_ACCOUNT_KEY?.trim());
}

async function pollLta(): Promise<VehiclePosition[]> {
  // Live client lands when AccountKey access is granted.
  throw new Error("LTA live client not wired yet");
}

/**
 * Cascade (BUS_SOURCE=auto):
 *   1. Live DataMall Arrival — when AccountKey is set and the client works
 *   2. Local `data/lta/BusArrival` dumps — offline / key / API failure fallback
 *   3. Skeleton fleet — last resort so the map still has motion
 *
 * After collect, buses are snapped onto `bus.geojson` when available
 * (`BUS_SNAP=0` to disable).
 */
export async function collectVehicles(
  requested: string = process.env.BUS_SOURCE ?? "auto",
): Promise<{ mode: SourceMode; vehicles: VehiclePosition[]; reason?: string }> {
  const mode = requested.toLowerCase();

  async function finish(result: {
    mode: SourceMode;
    vehicles: VehiclePosition[];
    reason?: string;
  }) {
    return {
      ...result,
      vehicles: await maybeSnap(result.vehicles),
    };
  }

  if (mode === "skeleton") {
    return finish({ mode: "skeleton", vehicles: skeleton.tick() });
  }

  if (mode === "fixture") {
    const vehicles = await vehiclesFromArrivalFixtures();
    if (vehicles.length === 0) {
      return finish({
        mode: "skeleton",
        vehicles: skeleton.tick(),
        reason: "no Arrival fixtures on disk",
      });
    }
    return finish({ mode: "fixture", vehicles });
  }

  if (mode === "lta") {
    if (!hasLtaKey()) {
      throw new Error("BUS_SOURCE=lta requires LTA_ACCOUNT_KEY");
    }
    return finish({ mode: "lta", vehicles: await pollLta() });
  }

  if (hasLtaKey()) {
    try {
      const vehicles = await pollLta();
      return finish({ mode: "lta", vehicles });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (await hasArrivalFixtures()) {
        return finish({
          mode: "fixture",
          vehicles: await vehiclesFromArrivalFixtures(),
          reason: `live LTA failed (${msg}); using local dumps`,
        });
      }
      return finish({
        mode: "skeleton",
        vehicles: skeleton.tick(),
        reason: `live LTA failed (${msg}); no fixtures`,
      });
    }
  }

  if (await hasArrivalFixtures()) {
    return finish({
      mode: "fixture",
      vehicles: await vehiclesFromArrivalFixtures(),
      reason: "no LTA_ACCOUNT_KEY; using local dumps",
    });
  }

  return finish({
    mode: "skeleton",
    vehicles: skeleton.tick(),
    reason: "no key and no Arrival fixtures",
  });
}
