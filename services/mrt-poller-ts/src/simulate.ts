import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";
import {
  colourForRailRef,
  isRailLineOpen,
  operatorForRailRef,
  railServiceStatus,
} from "@sg-transport/shared-types";
import type { FeatureCollection, LineString } from "geojson";
import { type LonLat, lineLengthMeters, pointAlongLine } from "./along-line.js";
import { fleetSize, headwaySecFor, lineSchedule } from "./schedule.js";
import { singaporeMinutesSinceMidnight } from "./service-hours.js";

export interface RailLine {
  id: string;
  ref: string;
  mode: VehicleMode;
  colour: string;
  operator?: string;
  /** open | construction | planned — only open lines get a simulated fleet. */
  status: string;
  coords: LonLat[];
}

interface SimTrain {
  id: string;
  line: RailLine;
  /** Position along line 0→1. */
  t: number;
  /** Fraction of the line per second. */
  speed: number;
  /** Bounce at ends. */
  dir: 1 | -1;
}

function modeFromRoute(route: unknown, ref: string): VehicleMode {
  if (route === "light_rail" || /LRT/i.test(ref)) return "lrt";
  return "mrt";
}

export function railLinesFromGeoJSON(fc: FeatureCollection): RailLine[] {
  const lines: RailLine[] = [];
  for (const feature of fc.features) {
    if (feature.geometry?.type !== "LineString") continue;
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const ref = String(props.ref ?? props.id ?? "UNK");
    const id = String(props.id ?? `rail-${ref}`);
    const coords = (feature.geometry as LineString).coordinates as LonLat[];
    if (coords.length < 2) continue;
    const colour =
      typeof props.colour === "string" && props.colour.startsWith("#")
        ? colourForRailRef(ref, props.colour)
        : colourForRailRef(ref);
    lines.push({
      id,
      ref,
      mode: modeFromRoute(props.route, ref),
      colour,
      operator:
        operatorForRailRef(ref) ??
        (typeof props.operator === "string" ? props.operator : undefined),
      status: railServiceStatus(ref),
      coords,
    });
  }
  return lines;
}

/**
 * Scale published end-to-end minutes to this geometry's length so short
 * OSM scraps (branches / loops) get fewer trains and shorter run times.
 */
function endToEndSecForLine(line: RailLine): number {
  const schedule = lineSchedule(line.ref);
  const publishedSec = schedule.endToEndMin * 60;
  const meters = lineLengthMeters(line.coords);
  // Full NSL-class corridor ~45–55 km; scale run time by length, clamp.
  const REF_METERS = 45_000;
  const scaled = publishedSec * Math.min(1.2, Math.max(0.15, meters / REF_METERS));
  return Math.max(4 * 60, scaled);
}

/**
 * Seed a headway-spaced fleet per rail feature using the current peak/off-peak
 * headway. Speed comes from published end-to-end time (scaled by geometry).
 */
export function seedTrains(lines: RailLine[], now = new Date()): SimTrain[] {
  const mins = singaporeMinutesSinceMidnight(now);
  const trains: SimTrain[] = [];

  for (const line of lines) {
    // Under-construction / planned corridors stay on the static map only.
    if (!isRailLineOpen(line.ref)) continue;
    const schedule = lineSchedule(line.ref);
    const endToEndSec = endToEndSecForLine(line);
    const headway = headwaySecFor(schedule, mins);
    const count = fleetSize(endToEndSec, headway);
    const speed = 1 / endToEndSec;

    for (let i = 0; i < count; i++) {
      trains.push({
        id: `sim-${line.ref}-${line.id}-${i}`,
        line,
        t: count === 1 ? 0.15 : i / count,
        speed,
        dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
      });
    }
  }

  return trains;
}

export function tickTrains(
  trains: SimTrain[],
  dtSec: number,
  now = Date.now(),
): VehiclePosition[] {
  const out: VehiclePosition[] = [];
  for (const train of trains) {
    train.t += train.dir * train.speed * dtSec;
    if (train.t >= 1) {
      train.t = 1;
      train.dir = -1;
    } else if (train.t <= 0) {
      train.t = 0;
      train.dir = 1;
    }
    const pos = pointAlongLine(train.line.coords, train.t);
    const bearing = train.dir === 1 ? pos.bearing : (pos.bearing + 180) % 360;
    out.push({
      id: train.id,
      mode: train.line.mode,
      lat: pos.lat,
      lon: pos.lon,
      bearing,
      observedAt: now,
      isInferred: true,
      lineRef: train.line.ref,
      color: train.line.colour,
      operator: train.line.operator,
    });
  }
  return out;
}
