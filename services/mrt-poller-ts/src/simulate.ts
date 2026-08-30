import type { FeatureCollection, LineString } from "geojson";
import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";
import { pointAlongLine, type LonLat } from "./along-line.js";

export interface RailLine {
  id: string;
  ref: string;
  mode: VehicleMode;
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
    lines.push({
      id,
      ref,
      mode: modeFromRoute(props.route, ref),
      coords,
    });
  }
  return lines;
}

/** One train per rail feature, staggered starts, inferred motion. */
export function seedTrains(lines: RailLine[]): SimTrain[] {
  return lines.map((line, i) => ({
    id: `sim-${line.ref}-${i}`,
    line,
    t: (i * 0.17) % 1,
    // ~8–14 minutes end-to-end depending on line length feel.
    speed: 0.0012 + (i % 5) * 0.00015,
    dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
  }));
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
    const bearing =
      train.dir === 1 ? pos.bearing : (pos.bearing + 180) % 360;
    out.push({
      id: train.id,
      mode: train.line.mode,
      lat: pos.lat,
      lon: pos.lon,
      bearing,
      observedAt: now,
      isInferred: true,
    });
  }
  return out;
}
