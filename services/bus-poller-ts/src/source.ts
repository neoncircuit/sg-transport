import type { VehiclePosition } from "@sg-transport/shared-types";
import {
  hasArrivalFixtures,
  vehiclesFromArrivalFixtures,
} from "./fixture.js";
import { SkeletonBusSource } from "./skeleton.js";

/** How we obtained the fleet for this tick. */
export type SourceMode = "lta" | "fixture" | "skeleton";

const skeleton = new SkeletonBusSource();

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
 * Force a rung with BUS_SOURCE=lta|fixture|skeleton.
 */
export async function collectVehicles(
  requested: string = process.env.BUS_SOURCE ?? "auto",
): Promise<{ mode: SourceMode; vehicles: VehiclePosition[]; reason?: string }> {
  const mode = requested.toLowerCase();

  if (mode === "skeleton") {
    return { mode: "skeleton", vehicles: skeleton.tick() };
  }

  if (mode === "fixture") {
    const vehicles = await vehiclesFromArrivalFixtures();
    if (vehicles.length === 0) {
      return {
        mode: "skeleton",
        vehicles: skeleton.tick(),
        reason: "no Arrival fixtures on disk",
      };
    }
    return { mode: "fixture", vehicles };
  }

  if (mode === "lta") {
    if (!hasLtaKey()) {
      throw new Error("BUS_SOURCE=lta requires LTA_ACCOUNT_KEY");
    }
    return { mode: "lta", vehicles: await pollLta() };
  }

  // --- auto cascade ---
  if (hasLtaKey()) {
    try {
      const vehicles = await pollLta();
      return { mode: "lta", vehicles };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (await hasArrivalFixtures()) {
        return {
          mode: "fixture",
          vehicles: await vehiclesFromArrivalFixtures(),
          reason: `live LTA failed (${msg}); using local dumps`,
        };
      }
      return {
        mode: "skeleton",
        vehicles: skeleton.tick(),
        reason: `live LTA failed (${msg}); no fixtures`,
      };
    }
  }

  if (await hasArrivalFixtures()) {
    return {
      mode: "fixture",
      vehicles: await vehiclesFromArrivalFixtures(),
      reason: "no LTA_ACCOUNT_KEY; using local dumps",
    };
  }

  return {
    mode: "skeleton",
    vehicles: skeleton.tick(),
    reason: "no key and no Arrival fixtures",
  };
}
