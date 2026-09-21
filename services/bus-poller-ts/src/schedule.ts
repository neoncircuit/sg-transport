/**
 * Arrival poll scheduling helpers (DESIGN.md §7.1).
 *
 * Bus Arrival updates every ~20s and is per BusStopCode. With ~5k stops you
 * cannot poll every stop every cycle under a daily call budget — tier stops
 * and rotate within each tier.
 */

import type { Feature, FeatureCollection, Point } from "geojson";

/** Official DataMall Arrival update frequency (User Guide v6.9). */
export const ARRIVAL_UPDATE_MS = 20_000;

/** Default Arrival calls per cycle — ~173k/day at 20s, well under 10M ToS. */
export const DEFAULT_ARRIVAL_BUDGET = 40;

/** Parallel Arrival fetches per cycle (still capped by budget). */
export const DEFAULT_ARRIVAL_CONCURRENCY = 8;

export type StopTier = "hot" | "normal" | "cold";

export interface ScheduledStop {
  busStopCode: string;
  tier: StopTier;
}

export interface PollPlan {
  /** Stops to hit this cycle. */
  stops: string[];
  /** Suggested delay before the next cycle. */
  nextDelayMs: number;
}

const TIER_WEIGHT: Record<StopTier, number> = {
  hot: 3,
  normal: 2,
  cold: 1,
};

/** Rough downtown / Marina / Bras Basah box for default hot stops. */
export const CBD_BBOX = {
  minLon: 103.82,
  maxLon: 103.87,
  minLat: 1.265,
  maxLat: 1.31,
} as const;

/**
 * Build a weighted round-robin plan. `budget` is max Arrival calls this tick.
 * Hot stops appear more often across cycles via the cursor.
 */
export function planArrivalPoll(
  stops: ScheduledStop[],
  cursor: number,
  budget: number,
): { plan: PollPlan; nextCursor: number } {
  if (stops.length === 0 || budget <= 0) {
    return {
      plan: { stops: [], nextDelayMs: ARRIVAL_UPDATE_MS },
      nextCursor: cursor,
    };
  }

  const weighted: string[] = [];
  for (const stop of stops) {
    const w = TIER_WEIGHT[stop.tier] ?? 1;
    for (let i = 0; i < w; i++) weighted.push(stop.busStopCode);
  }

  const picked: string[] = [];
  const seen = new Set<string>();
  let i = cursor % weighted.length;
  let guard = 0;
  while (picked.length < budget && guard < weighted.length * 2) {
    const code = weighted[i]!;
    if (!seen.has(code)) {
      seen.add(code);
      picked.push(code);
    }
    i = (i + 1) % weighted.length;
    guard += 1;
  }

  return {
    plan: { stops: picked, nextDelayMs: ARRIVAL_UPDATE_MS },
    nextCursor: i,
  };
}

/** Classify stops: optional hot list, everyone else normal (cold later). */
export function classifyStops(
  codes: string[],
  hotCodes: Iterable<string> = [],
): ScheduledStop[] {
  const hot = new Set(hotCodes);
  return codes.map((busStopCode) => ({
    busStopCode,
    tier: hot.has(busStopCode) ? "hot" : "normal",
  }));
}

function pointCoords(feature: Feature): [number, number] | null {
  if (feature.geometry?.type !== "Point") return null;
  const c = (feature.geometry as Point).coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lon = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

function inCbd(lon: number, lat: number): boolean {
  return (
    lon >= CBD_BBOX.minLon &&
    lon <= CBD_BBOX.maxLon &&
    lat >= CBD_BBOX.minLat &&
    lat <= CBD_BBOX.maxLat
  );
}

/**
 * Tier stops from geometry: CBD → hot (capped), else normal.
 * Skips fixture W00x codes. `hotOverride` wins when non-empty.
 */
export function classifyStopsFromGeoJSON(
  fc: FeatureCollection,
  options?: { hotOverride?: Iterable<string>; hotCap?: number },
): ScheduledStop[] {
  const hotOverride = [...(options?.hotOverride ?? [])].filter(Boolean);
  const hotCap = options?.hotCap ?? 120;

  if (hotOverride.length > 0) {
    const codes: string[] = [];
    const seen = new Set<string>();
    for (const f of fc.features) {
      const code = f.properties?.busStopCode;
      if (typeof code !== "string" || !code || /^W\d+/i.test(code)) continue;
      if (seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
    }
    return classifyStops(codes, hotOverride);
  }

  const hot: string[] = [];
  const normal: string[] = [];
  const seen = new Set<string>();

  for (const f of fc.features) {
    const code = f.properties?.busStopCode;
    if (typeof code !== "string" || !code || /^W\d+/i.test(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    const coords = pointCoords(f);
    if (coords && inCbd(coords[0], coords[1]) && hot.length < hotCap) {
      hot.push(code);
    } else {
      normal.push(code);
    }
  }

  return [
    ...hot.map((busStopCode) => ({ busStopCode, tier: "hot" as const })),
    ...normal.map((busStopCode) => ({ busStopCode, tier: "normal" as const })),
  ];
}

/** Rough daily call count at a fixed cadence (for docs / sanity checks). */
export function estimateDailyArrivalCalls(
  budgetPerCycle: number,
  intervalMs = ARRIVAL_UPDATE_MS,
): number {
  if (budgetPerCycle <= 0 || intervalMs <= 0) return 0;
  return Math.floor((86_400_000 / intervalMs) * budgetPerCycle);
}
