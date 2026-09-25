import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GtfsRailScheduleFile } from "./gtfs-schedule.js";
import { setGtfsScheduleOverlay } from "./schedule.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_JSON = path.resolve(here, "../data/rail-gtfs-schedule.json");

/**
 * Load community-GTFS rail overlay if present.
 * Path: MRT_GTFS_SCHEDULE_JSON or services/mrt-poller-ts/data/rail-gtfs-schedule.json
 */
export async function loadGtfsScheduleOverlay(): Promise<GtfsRailScheduleFile | null> {
  const file = process.env.MRT_GTFS_SCHEDULE_JSON?.trim() || DEFAULT_JSON;
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as GtfsRailScheduleFile;
    if (!raw?.lines || typeof raw.lines !== "object") {
      console.warn(`[mrt-poller] GTFS schedule JSON missing lines: ${file}`);
      return null;
    }
    setGtfsScheduleOverlay(raw);
    const n = Object.keys(raw.lines).length;
    console.log(
      `[mrt-poller] GTFS schedule overlay ← ${file} (${n} lines, source=${raw.source})`,
    );
    return raw;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(
        `[mrt-poller] GTFS schedule load failed (${err instanceof Error ? err.message : err})`,
      );
    }
    setGtfsScheduleOverlay(null);
    return null;
  }
}
