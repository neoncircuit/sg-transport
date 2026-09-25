import { readFile } from "node:fs/promises";
import path from "node:path";
import { GTFS_ROUTE_TO_REF, gtfsTimeToMinutes, parseCsv } from "./gtfs-csv.js";
import type { LineSchedule } from "./schedule.js";

export interface GtfsRailScheduleFile {
  source: string;
  fetchedAt: string;
  lines: Record<string, Omit<LineSchedule, "ref">>;
}

interface Acc {
  firstMin: number;
  lastMin: number;
  headways: number[];
  endToEndMin: number[];
}

/**
 * Build per-line schedules from an extracted GTFS folder (rail only).
 * Uses `frequencies.txt` + first/last `stop_times` for end-to-end minutes.
 */
export async function railSchedulesFromGtfsDir(
  dir: string,
  sourceLabel: string,
): Promise<GtfsRailScheduleFile> {
  const [routesRaw, tripsRaw, freqRaw, stopTimesRaw] = await Promise.all([
    readFile(path.join(dir, "routes.txt"), "utf8"),
    readFile(path.join(dir, "trips.txt"), "utf8"),
    readFile(path.join(dir, "frequencies.txt"), "utf8"),
    readFile(path.join(dir, "stop_times.txt"), "utf8"),
  ]);

  const routes = parseCsv(routesRaw);
  const trips = parseCsv(tripsRaw);
  const frequencies = parseCsv(freqRaw);
  const stopTimes = parseCsv(stopTimesRaw);

  const railRouteIds = new Set(
    routes
      .filter((r) => r.route_type === "0" || r.route_type === "1")
      .map((r) => r.route_id),
  );

  const tripToRef = new Map<string, string>();
  for (const trip of trips) {
    if (!railRouteIds.has(trip.route_id)) continue;
    const ref = GTFS_ROUTE_TO_REF[trip.route_id ?? ""];
    if (!ref || !trip.trip_id) continue;
    tripToRef.set(trip.trip_id, ref);
  }

  const freqByTrip = new Map(
    frequencies.map((f) => [
      f.trip_id,
      {
        start: gtfsTimeToMinutes(f.start_time ?? "0:0:0"),
        end: gtfsTimeToMinutes(f.end_time ?? "0:0:0"),
        headway: Number(f.headway_secs) || 0,
      },
    ]),
  );

  const timesByTrip = new Map<string, number[]>();
  for (const st of stopTimes) {
    if (!st.trip_id || !tripToRef.has(st.trip_id)) continue;
    if (!freqByTrip.has(st.trip_id)) continue;
    const list = timesByTrip.get(st.trip_id) ?? [];
    list.push(gtfsTimeToMinutes(st.arrival_time || st.departure_time || "0:0:0"));
    timesByTrip.set(st.trip_id, list);
  }

  const byRef = new Map<string, Acc>();

  for (const [tripId, ref] of tripToRef) {
    const freq = freqByTrip.get(tripId);
    if (!freq || freq.headway <= 0) continue;

    const times = (timesByTrip.get(tripId) ?? []).slice().sort((a, b) => a - b);
    const e2e =
      times.length >= 2 ? Math.max(1, times[times.length - 1]! - times[0]!) : 0;

    const endClock = freq.end % (24 * 60);
    const acc = byRef.get(ref) ?? {
      firstMin: freq.start,
      lastMin: endClock,
      headways: [],
      endToEndMin: [],
    };
    acc.firstMin = Math.min(acc.firstMin, freq.start);
    // Later end wins; if service wraps past midnight, endClock is small.
    if (freq.end >= 24 * 60 || endClock < freq.start) {
      acc.lastMin = Math.max(acc.lastMin, endClock);
    } else {
      acc.lastMin = Math.max(acc.lastMin, endClock);
    }
    acc.headways.push(freq.headway);
    if (e2e > 0) acc.endToEndMin.push(e2e);
    byRef.set(ref, acc);
  }

  const lines: GtfsRailScheduleFile["lines"] = {};
  for (const [ref, acc] of byRef) {
    const hw = Math.round(
      acc.headways.reduce((a, b) => a + b, 0) / Math.max(1, acc.headways.length),
    );
    const e2e =
      acc.endToEndMin.length > 0
        ? Math.round(
            acc.endToEndMin.reduce((a, b) => a + b, 0) / acc.endToEndMin.length,
          )
        : 50;
    lines[ref] = {
      firstMin: acc.firstMin,
      lastMin: acc.lastMin,
      peakHeadwaySec: hw,
      offPeakHeadwaySec: hw,
      endToEndMin: e2e,
    };
  }

  return {
    source: sourceLabel,
    fetchedAt: new Date().toISOString(),
    lines,
  };
}
