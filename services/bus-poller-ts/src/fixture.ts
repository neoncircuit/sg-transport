import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VehiclePosition } from "@sg-transport/shared-types";
import {
  normalizeBusArrival,
  type LtaBusArrivalResponse,
} from "./normalize.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LTA_DIR = path.resolve(here, "../../../data/lta");

function ltaDir(): string {
  return process.env.LTA_DATA_DIR?.trim() || DEFAULT_LTA_DIR;
}

function isArrivalPayload(value: unknown): value is LtaBusArrivalResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.BusStopCode === "string" && Array.isArray(v.Services);
}

/**
 * Load Bus Arrival JSON dumps from data/lta/BusArrival/.
 * Accepts `BusArrival.json` or `<BusStopCode>.json`.
 */
export async function loadArrivalFixtures(
  dir = path.join(ltaDir(), "BusArrival"),
): Promise<{ file: string; payload: LtaBusArrivalResponse }[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const out: { file: string; payload: LtaBusArrivalResponse }[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const full = path.join(dir, name);
    const raw = JSON.parse(await readFile(full, "utf8")) as unknown;
    if (!isArrivalPayload(raw)) {
      console.warn(`[bus-poller] skip non-Arrival JSON: ${name}`);
      continue;
    }
    out.push({ file: name, payload: raw });
  }
  return out;
}

export async function vehiclesFromArrivalFixtures(
  now = Date.now(),
): Promise<VehiclePosition[]> {
  const fixtures = await loadArrivalFixtures();
  const vehicles: VehiclePosition[] = [];
  for (const { payload } of fixtures) {
    vehicles.push(...normalizeBusArrival(payload, now));
  }
  return vehicles;
}

export async function hasArrivalFixtures(): Promise<boolean> {
  const fixtures = await loadArrivalFixtures();
  return fixtures.length > 0;
}
