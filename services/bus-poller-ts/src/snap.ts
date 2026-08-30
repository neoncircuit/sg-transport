import nearestPointOnLine from "@turf/nearest-point-on-line";
import { lineString, point } from "@turf/helpers";
import type { Feature, FeatureCollection, LineString } from "geojson";
import type { VehiclePosition } from "@sg-transport/shared-types";

export interface SnapOptions {
  /** Max snap distance in kilometres (Turf default units). */
  maxKm?: number;
}

/**
 * Snap bus GPS onto the nearest route LineString (DESIGN.md Phase 2).
 * Vehicles farther than `maxKm` from any line are left unchanged.
 */
export function snapVehiclesToRoutes(
  vehicles: VehiclePosition[],
  routes: FeatureCollection,
  options: SnapOptions = {},
): VehiclePosition[] {
  const maxKm = options.maxKm ?? 0.35;
  const lines = routes.features.filter(
    (f): f is Feature<LineString> => f.geometry?.type === "LineString",
  );
  if (lines.length === 0) return vehicles;

  return vehicles.map((v) => {
    if (v.mode !== "bus") return v;
    const pt = point([v.lon, v.lat]);
    let best: ReturnType<typeof nearestPointOnLine> | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const feature of lines) {
      const line = lineString(feature.geometry.coordinates);
      const snapped = nearestPointOnLine(line, pt, { units: "kilometers" });
      const dist = snapped.properties.dist ?? Number.POSITIVE_INFINITY;
      if (dist < bestDist) {
        bestDist = dist;
        best = snapped;
      }
    }

    if (!best || bestDist > maxKm) return v;
    const [lon, lat] = best.geometry.coordinates;
    return {
      ...v,
      lon,
      lat,
      // Keep GPS bearing if present; line heading can come later.
    };
  });
}

export function linesFromGeoJSON(data: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.features.filter((f) => f.geometry?.type === "LineString"),
  };
}
