/**
 * Arrival poll scheduling helpers (DESIGN.md §7.1).
 *
 * Bus Arrival updates every ~20s and is per BusStopCode. With ~5k stops you
 * cannot poll every stop every cycle under a daily call budget — tier stops
 * and rotate within each tier.
 */

/** Official DataMall Arrival update frequency (User Guide v6.9). */
export const ARRIVAL_UPDATE_MS = 20_000;

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
