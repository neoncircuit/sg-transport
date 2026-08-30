import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

const RAIL_SOURCE = "static-rail";
const RAIL_LAYER = "static-rail-line";
const BUS_SOURCE = "static-bus";
const BUS_LAYER = "static-bus-line";

/**
 * Add static route geometry as background line layers (under vehicles).
 * Rail from OSM extract; bus optional until LTA extract exists.
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
          map.getLayer("vehicles-glow") ? "vehicles-glow" : undefined,
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
        map.addSource(BUS_SOURCE, { type: "geojson", data });
        map.addLayer(
          {
            id: BUS_LAYER,
            type: "line",
            source: BUS_SOURCE,
            paint: {
              "line-color": "#f0a35e",
              "line-width": 1,
              "line-opacity": 0.22,
            },
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
          },
          map.getLayer(RAIL_LAYER) ? RAIL_LAYER : undefined,
        );
      }
    } catch {
      // Bus layer is optional until LTA_ACCOUNT_KEY extract exists.
    }
  }
}
