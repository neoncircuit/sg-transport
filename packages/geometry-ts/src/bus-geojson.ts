import type { Feature, FeatureCollection, LineString, Point } from "geojson";

export interface BusStop {
  BusStopCode: string;
  Latitude: number;
  Longitude: number;
  Description?: string;
  RoadName?: string;
}

export interface BusRouteRow {
  ServiceNo: string;
  Direction: number;
  StopSequence: number;
  BusStopCode: string;
}

/** Join LTA BusStops + BusRoutes into stop-sequence LineStrings per service. */
export function buildServiceLines(
  stops: BusStop[],
  routes: BusRouteRow[],
): FeatureCollection {
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
    const coords: [number, number][] = [];
    for (const row of sorted) {
      const stop = stopByCode.get(row.BusStopCode);
      if (!stop) continue;
      coords.push([stop.Longitude, stop.Latitude]);
    }
    if (coords.length < 2) continue;
    const [serviceNo, direction] = key.split("::");
    features.push({
      type: "Feature",
      properties: {
        id: `bus-${serviceNo}-d${direction}`,
        serviceNo,
        direction: Number(direction),
        source: "lta-datamall",
        note: "stop-to-stop straight segments; OSM snap comes later",
      },
      geometry: { type: "LineString", coordinates: coords },
    });
  }

  return { type: "FeatureCollection", features };
}

/** Point features for every stop (map dots / debug). */
export function buildStopPoints(stops: BusStop[]): FeatureCollection {
  const features: Feature<Point>[] = stops.map((stop) => ({
    type: "Feature",
    properties: {
      id: `stop-${stop.BusStopCode}`,
      busStopCode: stop.BusStopCode,
      description: stop.Description ?? "",
      roadName: stop.RoadName ?? "",
      source: "lta-datamall",
    },
    geometry: {
      type: "Point",
      coordinates: [stop.Longitude, stop.Latitude],
    },
  }));
  return { type: "FeatureCollection", features };
}
