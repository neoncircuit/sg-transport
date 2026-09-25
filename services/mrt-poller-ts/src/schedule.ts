/**
 * Published-approximate MRT/LRT operating profile (Asia/Singapore).
 *
 * Exact station-level first/last and GTFS frequencies are not on DataMall.
 * Figures below are rounded from operator / LTA system-map guidance so the
 * simulator densifies in peak and clears overnight per line — not a timetable.
 */

import { normalizeRailRef } from "@sg-transport/shared-types";
import type { GtfsRailScheduleFile } from "./gtfs-schedule.js";

export interface LineSchedule {
  ref: string;
  /** First train, minutes since midnight SGT. */
  firstMin: number;
  /**
   * Last-train cutoff (minutes since midnight SGT). May be < firstMin when
   * service wraps past midnight (e.g. 00:30 → 30).
   */
  lastMin: number;
  /** Peak headway in seconds (AM/PM rush). */
  peakHeadwaySec: number;
  /** Off-peak headway in seconds. */
  offPeakHeadwaySec: number;
  /** Typical terminus→terminus run time (minutes), one direction. */
  endToEndMin: number;
  /** Where this row came from (builtin | gtfs). */
  source?: "builtin" | "gtfs";
}

const DEFAULT: Omit<LineSchedule, "ref"> = {
  firstMin: 5 * 60 + 30,
  lastMin: 30,
  peakHeadwaySec: 3 * 60,
  offPeakHeadwaySec: 6 * 60,
  endToEndMin: 50,
  source: "builtin",
};

/** Peak windows (SGT): weekday-ish rush, used for headway selection. */
export const PEAK_WINDOWS: ReadonlyArray<{ start: number; end: number }> = [
  { start: 7 * 60, end: 9 * 60 },
  { start: 17 * 60 + 30, end: 19 * 60 + 30 },
];

const BY_REF: Record<string, Omit<LineSchedule, "ref">> = {
  NSL: {
    firstMin: 5 * 60 + 30,
    lastMin: 30,
    peakHeadwaySec: 2 * 60 + 30,
    offPeakHeadwaySec: 6 * 60,
    endToEndMin: 65,
    source: "builtin",
  },
  EWL: {
    firstMin: 5 * 60 + 30,
    lastMin: 30,
    peakHeadwaySec: 2 * 60 + 30,
    offPeakHeadwaySec: 6 * 60,
    endToEndMin: 70,
    source: "builtin",
  },
  NEL: {
    firstMin: 5 * 60 + 45,
    lastMin: 15,
    peakHeadwaySec: 2 * 60 + 30,
    offPeakHeadwaySec: 6 * 60,
    endToEndMin: 40,
    source: "builtin",
  },
  CCL: {
    firstMin: 5 * 60 + 30,
    lastMin: 23 * 60 + 30,
    peakHeadwaySec: 3 * 60,
    offPeakHeadwaySec: 6 * 60,
    endToEndMin: 55,
    source: "builtin",
  },
  DTL: {
    firstMin: 5 * 60 + 30,
    lastMin: 15,
    peakHeadwaySec: 2 * 60 + 30,
    offPeakHeadwaySec: 5 * 60,
    endToEndMin: 70,
    source: "builtin",
  },
  TEL: {
    firstMin: 5 * 60 + 30,
    lastMin: 15,
    peakHeadwaySec: 3 * 60,
    offPeakHeadwaySec: 6 * 60,
    endToEndMin: 60,
    source: "builtin",
  },
  JRL: {
    firstMin: 5 * 60 + 30,
    lastMin: 0,
    peakHeadwaySec: 4 * 60,
    offPeakHeadwaySec: 7 * 60,
    endToEndMin: 35,
    source: "builtin",
  },
  CRL: {
    firstMin: 5 * 60 + 30,
    lastMin: 0,
    peakHeadwaySec: 4 * 60,
    offPeakHeadwaySec: 7 * 60,
    endToEndMin: 50,
    source: "builtin",
  },
  BPLRT: {
    firstMin: 5 * 60 + 15,
    lastMin: 30,
    peakHeadwaySec: 3 * 60,
    offPeakHeadwaySec: 6 * 60,
    endToEndMin: 18,
    source: "builtin",
  },
  SKLRT: {
    firstMin: 5 * 60 + 20,
    lastMin: 30,
    peakHeadwaySec: 3 * 60,
    offPeakHeadwaySec: 6 * 60,
    endToEndMin: 15,
    source: "builtin",
  },
  PGLRT: {
    firstMin: 5 * 60 + 20,
    lastMin: 30,
    peakHeadwaySec: 3 * 60,
    offPeakHeadwaySec: 6 * 60,
    endToEndMin: 15,
    source: "builtin",
  },
};

/** Optional community-GTFS overlay (loaded at poller startup). */
let gtfsOverlay: GtfsRailScheduleFile | null = null;

export function setGtfsScheduleOverlay(file: GtfsRailScheduleFile | null): void {
  gtfsOverlay = file;
}

export function gtfsScheduleOverlay(): GtfsRailScheduleFile | null {
  return gtfsOverlay;
}

export function lineSchedule(ref: string | undefined | null): LineSchedule {
  const key = normalizeRailRef(ref);
  const builtin = (key && BY_REF[key]) || DEFAULT;
  const fromGtfs = key ? gtfsOverlay?.lines[key] : undefined;
  if (fromGtfs) {
    return {
      ref: key || "UNK",
      ...fromGtfs,
      // Keep a mild peak densification even when GTFS is flat all-day.
      peakHeadwaySec: Math.min(
        fromGtfs.peakHeadwaySec,
        Math.round(fromGtfs.peakHeadwaySec * 0.85),
      ),
      offPeakHeadwaySec: fromGtfs.offPeakHeadwaySec,
      source: "gtfs",
    };
  }
  return { ref: key || "UNK", ...builtin, source: builtin.source ?? "builtin" };
}

export function isPeakMinutes(mins: number): boolean {
  return PEAK_WINDOWS.some((w) => mins >= w.start && mins < w.end);
}

export function headwaySecFor(schedule: LineSchedule, mins: number): number {
  return isPeakMinutes(mins) ? schedule.peakHeadwaySec : schedule.offPeakHeadwaySec;
}

/**
 * Service window that may wrap midnight (first=05:30, last=00:30 → end=30).
 * Active while mins ∈ [first, 24h) ∪ [0, last).
 */
export function isLineInService(schedule: LineSchedule, mins: number): boolean {
  const { firstMin, lastMin } = schedule;
  if (firstMin === lastMin) return true;
  if (firstMin < lastMin) {
    return mins >= firstMin && mins < lastMin;
  }
  return mins >= firstMin || mins < lastMin;
}

/** How many trains to place on one geometry given run time + headway. */
export function fleetSize(endToEndSec: number, headwaySec: number, cap = 10): number {
  if (headwaySec <= 0 || endToEndSec <= 0) return 1;
  return Math.max(1, Math.min(cap, Math.round(endToEndSec / headwaySec)));
}

export function formatClock(mins: number): string {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function scheduleLabel(schedule: LineSchedule): string {
  return `${schedule.ref} ${formatClock(schedule.firstMin)}–${formatClock(schedule.lastMin)} · peak ${schedule.peakHeadwaySec / 60}m / off ${schedule.offPeakHeadwaySec / 60}m`;
}
