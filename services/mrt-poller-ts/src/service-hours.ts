/**
 * Network / per-line service windows in Asia/Singapore.
 *
 * Override: MRT_FORCE_SERVICE=1|0 (forces all lines on/off).
 */

import { isLineInService, type LineSchedule, lineSchedule } from "./schedule.js";

const TZ = "Asia/Singapore";

export function singaporeMinutesSinceMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function forceService(): boolean | undefined {
  const forced = process.env.MRT_FORCE_SERVICE?.trim();
  if (forced === "1" || forced?.toLowerCase() === "true") return true;
  if (forced === "0" || forced?.toLowerCase() === "false") return false;
  return undefined;
}

/** True if any typical line would be running (legacy network gate). */
export function isRailServiceWindow(now = new Date()): boolean {
  const forced = forceService();
  if (forced !== undefined) return forced;
  // Union of NSL-like window: if the main trunk is shut, clear the map.
  return isLineInService(lineSchedule("NSL"), singaporeMinutesSinceMidnight(now));
}

export function isRefInService(ref: string, now = new Date()): boolean {
  const forced = forceService();
  if (forced !== undefined) return forced;
  return isLineInService(lineSchedule(ref), singaporeMinutesSinceMidnight(now));
}

export function railServiceWindowLabel(): string {
  const nsl = lineSchedule("NSL");
  return `per-line schedules (e.g. NSL SGT ${padClock(nsl.firstMin)}–${padClock(nsl.lastMin)}; MRT_FORCE_SERVICE=1|0)`;
}

function padClock(mins: number): string {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function scheduleForRef(ref: string): LineSchedule {
  return lineSchedule(ref);
}
