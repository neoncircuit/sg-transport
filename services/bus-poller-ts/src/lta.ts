import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureCollection } from "geojson";
import type { VehiclePosition } from "@sg-transport/shared-types";
import {
  normalizeBusArrival,
  type LtaBusArrivalResponse,
} from "./normalize.js";
import {
  ARRIVAL_UPDATE_MS,
  classifyStops,
  planArrivalPoll,
} from "./schedule.js";

const DEFAULT_BASE =
  "https://datamall2.mytransport.sg/ltaodataservice";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STOPS_GEOJSON = path.resolve(
  here,
  "../../../packages/geometry-ts/data/bus-stops.geojson",
);

let pollCursor = 0;

function datamallBase(): string {
  return (
    process.env.LTA_DATAMALL_BASE?.trim() || DEFAULT_BASE
  ).replace(/\/$/, "");
}

function accountKey(): string {
  const key = process.env.LTA_ACCOUNT_KEY?.trim();
  if (!key) throw new Error("LTA_ACCOUNT_KEY is required");
  return key;
}

function arrivalBudget(): number {
  const n = Number(process.env.LTA_ARRIVAL_BUDGET ?? 12);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
}

function isArrivalPayload(value: unknown): value is LtaBusArrivalResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.BusStopCode === "string" && Array.isArray(v.Services);
}

/** Real stop codes only (skip DEMO west-corridor W00x fixtures). */
export function stopCodesFromGeoJSON(fc: FeatureCollection): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const f of fc.features) {
    const code = f.properties?.busStopCode;
    if (typeof code !== "string" || !code) continue;
    if (/^W\d+/i.test(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

export async function resolveStopCodes(): Promise<string[]> {
  const fromEnv = process.env.LTA_BUS_STOPS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const file = process.env.BUS_STOPS_GEOJSON?.trim() || DEFAULT_STOPS_GEOJSON;
  try {
    const fc = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
    const codes = stopCodesFromGeoJSON(fc);
    if (codes.length > 0) return codes;
  } catch {
    // fall through
  }

  // Sensible CBD defaults if geometry is missing.
  return ["01012", "01013", "01019", "01029"];
}

export async function fetchBusArrival(
  busStopCode: string,
  options?: { signal?: AbortSignal },
): Promise<LtaBusArrivalResponse> {
  const url = `${datamallBase()}/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;
  const res = await fetch(url, {
    headers: {
      AccountKey: accountKey(),
      Accept: "application/json",
    },
    signal: options?.signal ?? AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `BusArrival ${busStopCode} HTTP ${res.status}: ${body.slice(0, 160)}`,
    );
  }
  const json: unknown = await res.json();
  if (!isArrivalPayload(json)) {
    throw new Error(`BusArrival ${busStopCode}: unexpected payload shape`);
  }
  return json;
}

/**
 * Poll a budgeted slice of stops (20s cadence helpers in schedule.ts).
 * Dedupes vehicles by id across stops (same bus can appear at multiple).
 */
export async function pollLiveArrivals(
  now = Date.now(),
): Promise<{ vehicles: VehiclePosition[]; stopsPolled: number }> {
  const codes = await resolveStopCodes();
  const hot = (process.env.LTA_HOT_STOPS?.trim() || "01012,01013")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const scheduled = classifyStops(codes, hot);
  const { plan, nextCursor } = planArrivalPoll(
    scheduled,
    pollCursor,
    arrivalBudget(),
  );
  pollCursor = nextCursor;

  const vehicles: VehiclePosition[] = [];
  const seen = new Set<string>();
  let stopsPolled = 0;

  // Sequential to stay polite on the API; budget is small.
  for (const code of plan.stops) {
    const payload = await fetchBusArrival(code);
    stopsPolled += 1;
    for (const v of normalizeBusArrival(payload, now)) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      vehicles.push(v);
    }
  }

  return { vehicles, stopsPolled };
}

export { ARRIVAL_UPDATE_MS };
