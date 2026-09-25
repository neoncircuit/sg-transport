import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VehiclePosition } from "@sg-transport/shared-types";
import type { FeatureCollection } from "geojson";
import { type LtaBusArrivalResponse, normalizeBusArrival } from "./normalize.js";
import {
  ARRIVAL_UPDATE_MS,
  classifyStops,
  classifyStopsFromGeoJSON,
  DEFAULT_ARRIVAL_BUDGET,
  DEFAULT_ARRIVAL_CONCURRENCY,
  estimateDailyArrivalCalls,
  planArrivalPoll,
  type ScheduledStop,
} from "./schedule.js";

const DEFAULT_BASE = "https://datamall2.mytransport.sg/ltaodataservice";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STOPS_GEOJSON = path.resolve(
  here,
  "../../../packages/geometry-ts/data/bus-stops.geojson",
);

let pollCursor = 0;
let loggedBudgetOnce = false;

function datamallBase(): string {
  return (process.env.LTA_DATAMALL_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

function accountKey(): string {
  const key = process.env.LTA_ACCOUNT_KEY?.trim();
  if (!key) throw new Error("LTA_ACCOUNT_KEY is required");
  return key;
}

function arrivalBudget(): number {
  const n = Number(process.env.LTA_ARRIVAL_BUDGET ?? DEFAULT_ARRIVAL_BUDGET);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_ARRIVAL_BUDGET;
}

function arrivalConcurrency(): number {
  const n = Number(process.env.LTA_ARRIVAL_CONCURRENCY ?? DEFAULT_ARRIVAL_CONCURRENCY);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_ARRIVAL_CONCURRENCY;
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

function parseCodeList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function resolveStopCodes(): Promise<string[]> {
  const fromEnv = parseCodeList(process.env.LTA_BUS_STOPS);
  if (fromEnv.length > 0) return fromEnv;

  const file = process.env.BUS_STOPS_GEOJSON?.trim() || DEFAULT_STOPS_GEOJSON;
  try {
    const fc = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
    const codes = stopCodesFromGeoJSON(fc);
    if (codes.length > 0) return codes;
  } catch {
    // fall through
  }

  return ["01012", "01013", "01019", "01029"];
}

async function resolveScheduledStops(): Promise<ScheduledStop[]> {
  const file = process.env.BUS_STOPS_GEOJSON?.trim() || DEFAULT_STOPS_GEOJSON;
  const hotOverride = parseCodeList(process.env.LTA_HOT_STOPS);
  const codeOverride = parseCodeList(process.env.LTA_BUS_STOPS);

  if (codeOverride.length > 0) {
    return classifyStops(codeOverride, hotOverride);
  }

  try {
    const fc = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
    const scheduled = classifyStopsFromGeoJSON(fc, { hotOverride });
    if (scheduled.length > 0) return scheduled;
  } catch {
    // fall through
  }

  return classifyStops(
    ["01012", "01013", "01019", "01029"],
    hotOverride.length > 0 ? hotOverride : ["01012", "01013"],
  );
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

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/**
 * Poll a budgeted slice of stops (20s cadence helpers in schedule.ts).
 * Dedupes vehicles by id across stops (same bus can appear at multiple).
 */
export async function pollLiveArrivals(
  now = Date.now(),
): Promise<{ vehicles: VehiclePosition[]; stopsPolled: number }> {
  const budget = arrivalBudget();
  const concurrency = arrivalConcurrency();
  const scheduled = await resolveScheduledStops();
  const { plan, nextCursor } = planArrivalPoll(scheduled, pollCursor, budget);
  pollCursor = nextCursor;

  if (!loggedBudgetOnce) {
    loggedBudgetOnce = true;
    const hot = scheduled.filter((s) => s.tier === "hot").length;
    console.log(
      `[bus-poller] Arrival budget=${budget}/cycle concurrency=${concurrency} ` +
        `(~${estimateDailyArrivalCalls(budget)} calls/day) · ` +
        `${scheduled.length} stops (${hot} hot)`,
    );
  }

  const payloads = await mapPool(plan.stops, concurrency, (code) =>
    fetchBusArrival(code),
  );

  const vehicles: VehiclePosition[] = [];
  const seen = new Set<string>();
  for (const payload of payloads) {
    for (const v of normalizeBusArrival(payload, now)) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      vehicles.push(v);
    }
  }

  return { vehicles, stopsPolled: plan.stops.length };
}

export { ARRIVAL_UPDATE_MS };
