import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

const RAIL_SOURCE = "static-rail";
const RAIL_LAYER = "static-rail-line";
const BUS_SOURCE = "static-bus";
const BUS_LAYER = "static-bus-line";
const BUS_STOPS_SOURCE = "static-bus-stops";
const BUS_STOPS_LAYER = "static-bus-stops-circle";

function beforeVehicles(map: MapLibreMap): string | undefined {
  return map.getLayer("vehicles-glow") ? "vehicles-glow" : undefined;
}

/**
 * Add static route geometry as background layers (under vehicles).
 * Rail from OSM; bus lines + stops from `pnpm extract:bus`.
 */
export async function ensureStaticGeometryLayers(map: MapLibreMap): Promise<void> {
  if (!map.getSource(RAIL_SOURCE)) {
    try {
      const res = await fetch("/geometry/rail.geojson");
      if (res.ok) {
        const data = (await res.json()) as FeatureCollection;
        map.addSource(RAIL_SOURCE, { type: "geojson", data });
        map.addLayer(
          {
            id: RAIL_LAYER,
            type: "line",
            source: RAIL_SOURCE,
            paint: {
              "line-color": ["coalesce", ["get", "colour"], "#8899aa"],
              "line-width": 2.25,
              "line-opacity": 0.72,
            },
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
          },
          beforeVehicles(map),
        );
      } else {
        console.warn("[map] rail.geojson not found — run geometry extract:rail");
      }
    } catch (err) {
      console.warn("[map] failed to load rail geometry", err);
    }
  }

  if (!map.getSource(BUS_SOURCE)) {
    try {
      const res = await fetch("/geometry/bus.geojson");
      if (res.ok) {
        const data = (await res.json()) as FeatureCollection;
        if (data.features.length > 0) {
          map.addSource(BUS_SOURCE, { type: "geojson", data });
          map.addLayer(
            {
              id: BUS_LAYER,
              type: "line",
              source: BUS_SOURCE,
              paint: {
                "line-color": "#f0a35e",
                "line-width": 2.5,
                "line-opacity": 0.55,
              },
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
            },
            map.getLayer(RAIL_LAYER) ? RAIL_LAYER : beforeVehicles(map),
          );
        }
      }
    } catch {
      // optional until extract:bus has overlapping dumps/fixtures
    }
  }

  if (!map.getSource(BUS_STOPS_SOURCE)) {
    try {
      const res = await fetch("/geometry/bus-stops.geojson");
      if (res.ok) {
        const data = (await res.json()) as FeatureCollection;
        if (data.features.length > 0) {
          map.addSource(BUS_STOPS_SOURCE, { type: "geojson", data });
          map.addLayer(
            {
              id: BUS_STOPS_LAYER,
              type: "circle",
              source: BUS_STOPS_SOURCE,
              paint: {
                "circle-radius": 3.5,
                "circle-color": "#f0a35e",
                "circle-opacity": 0.85,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#1a1a1a",
              },
            },
            map.getLayer(BUS_LAYER) ? BUS_LAYER : beforeVehicles(map),
          );
        }
      }
    } catch {
      // optional
    }
  }
}
