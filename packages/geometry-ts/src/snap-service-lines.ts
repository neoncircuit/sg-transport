import type { Feature, FeatureCollection, LineString } from "geojson";
import type { BusRouteRow, BusStop } from "./bus-geojson.js";
import { type LonLat, mapPool, type OsrmEdgeCache, osrmConcurrency } from "./osrm.js";

export interface SnapProgress {
  done: number;
  total: number;
  osrm: number;
  chord: number;
  cacheHits: number;
}

interface EdgeJob {
  fromCode: string;
  toCode: string;
  from: LonLat;
  to: LonLat;
}

function uniqueEdges(stops: BusStop[], routes: BusRouteRow[]): EdgeJob[] {
  const stopByCode = new Map(stops.map((s) => [s.BusStopCode, s]));
  const grouped = new Map<string, BusRouteRow[]>();
  for (const row of routes) {
    const key = `${row.ServiceNo}::${row.Direction}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const seen = new Map<string, EdgeJob>();
  for (const rows of grouped.values()) {
    const sorted = [...rows].sort((a, b) => a.StopSequence - b.StopSequence);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!;
      const b = sorted[i]!;
      const fromStop = stopByCode.get(a.BusStopCode);
      const toStop = stopByCode.get(b.BusStopCode);
      if (!fromStop || !toStop) continue;
      const id = `${a.BusStopCode}>${b.BusStopCode}`;
      if (seen.has(id)) continue;
      seen.set(id, {
        fromCode: a.BusStopCode,
        toCode: b.BusStopCode,
        from: [fromStop.Longitude, fromStop.Latitude],
        to: [toStop.Longitude, toStop.Latitude],
      });
    }
  }
  return [...seen.values()];
}

function stitch(segments: LonLat[][]): LonLat[] {
  const out: LonLat[] = [];
  for (const seg of segments) {
    if (seg.length === 0) continue;
    if (out.length === 0) {
      out.push(...seg);
      continue;
    }
    // Drop duplicate join vertex.
    out.push(...seg.slice(1));
  }
  return out;
}

/**
 * Rebuild service LineStrings by driving each consecutive stop pair (OSRM),
 * with disk-cached edges. Falls back to straight chords per-edge on failure.
 */
export async function buildRoadFollowingServiceLines(
  stops: BusStop[],
  routes: BusRouteRow[],
  cache: OsrmEdgeCache,
  onProgress?: (p: SnapProgress) => void,
): Promise<FeatureCollection> {
  await cache.ensureDir();
  const edges = uniqueEdges(stops, routes);
  const concurrency = osrmConcurrency();

  let osrm = 0;
  let chord = 0;
  let cacheHits = 0;
  let done = 0;

  const edgeCoords = new Map<string, LonLat[]>();

  await mapPool(edges, concurrency, async (edge) => {
    const resolved = await cache.resolve(
      edge.fromCode,
      edge.toCode,
      edge.from,
      edge.to,
    );
    if (resolved.cacheHit) cacheHits += 1;
    if (resolved.source === "osrm") osrm += 1;
    else chord += 1;
    edgeCoords.set(`${edge.fromCode}>${edge.toCode}`, resolved.coordinates);
    done += 1;
    if (onProgress && (done % 50 === 0 || done === edges.length)) {
      onProgress({ done, total: edges.length, osrm, chord, cacheHits });
    }
  });

  const stopByCode = new Map(stops.map((s) => [s.BusStopCode, s]));
  const grouped = new Map<string, BusRouteRow[]>();
  for (const row of routes) {
    const key = `${row.ServiceNo}::${row.Direction}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const features: Feature<LineString>[] = [];
  for (const [key, rows] of grouped) {
    const sorted = [...rows].sort((a, b) => a.StopSequence - b.StopSequence);
    const segments: LonLat[][] = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!;
      const b = sorted[i]!;
      const fromStop = stopByCode.get(a.BusStopCode);
      const toStop = stopByCode.get(b.BusStopCode);
      if (!fromStop || !toStop) continue;
      const id = `${a.BusStopCode}>${b.BusStopCode}`;
      const coords = edgeCoords.get(id);
      if (coords) {
        segments.push(coords);
      } else {
        segments.push([
          [fromStop.Longitude, fromStop.Latitude],
          [toStop.Longitude, toStop.Latitude],
        ]);
      }
    }
    const coordinates = stitch(segments);
    if (coordinates.length < 2) continue;
    const [serviceNo, direction] = key.split("::");
    features.push({
      type: "Feature",
      properties: {
        id: `bus-${serviceNo}-d${direction}`,
        serviceNo,
        direction: Number(direction),
        source: "lta+osrm",
        note: "OSRM road-following between LTA stops (chord fallback per edge)",
      },
      geometry: { type: "LineString", coordinates },
    });
  }

  return { type: "FeatureCollection", features };
}

export function routeSnapMode(): "off" | "osrm" {
  const raw = (process.env.BUS_ROUTE_SNAP ?? "off").trim().toLowerCase();
  if (raw === "osrm" || raw === "1" || raw === "true") return "osrm";
  return "off";
}
