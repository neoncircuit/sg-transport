import type { VehiclePosition } from "@sg-transport/shared-types";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { MODE_COLORS } from "./config";

const SOURCE_ID = "vehicles";
const LAYER_ID = "vehicles-circle";

function toFeatureCollection(vehicles: VehiclePosition[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: vehicles.map((v) => ({
      type: "Feature",
      properties: {
        id: v.id,
        mode: v.mode,
        color: MODE_COLORS[v.mode],
        bearing: v.bearing ?? 0,
        isInferred: v.isInferred,
      },
      geometry: {
        type: "Point",
        coordinates: [v.lon, v.lat],
      },
    })),
  };
}

export function ensureVehicleLayer(map: MapLibreMap): void {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: toFeatureCollection([]),
  });

  map.addLayer({
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": [
        "match",
        ["get", "mode"],
        "plane",
        7,
        "ship",
        6,
        "mrt",
        5.5,
        4.5,
      ],
      "circle-color": ["get", "color"],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#0b1220",
      "circle-opacity": 0.95,
    },
  });
}

export function updateVehicles(map: MapLibreMap, vehicles: VehiclePosition[]): void {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(toFeatureCollection(vehicles));
}
