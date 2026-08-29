import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { ThemeDefinition } from "./themes";

const SOURCE_ID = "vehicles";
const GLOW_LAYER_ID = "vehicles-glow";
const LAYER_ID = "vehicles-circle";

function toFeatureCollection(
  vehicles: VehiclePosition[],
  modeColors: Record<VehicleMode, string>,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: vehicles.map((v) => ({
      type: "Feature",
      properties: {
        id: v.id,
        mode: v.mode,
        color: modeColors[v.mode],
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

export function ensureVehicleLayer(map: MapLibreMap, theme: ThemeDefinition): void {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: toFeatureCollection([], theme.modeColors),
  });

  map.addLayer({
    id: GLOW_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": [
        "match",
        ["get", "mode"],
        "plane",
        14,
        "ship",
        12,
        "mrt",
        11,
        9,
      ],
      "circle-color": ["get", "color"],
      "circle-opacity": 0.22,
      "circle-blur": 0.85,
    },
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
        6.5,
        "ship",
        5.5,
        "mrt",
        5,
        4.25,
      ],
      "circle-color": ["get", "color"],
      "circle-stroke-width": 1.25,
      "circle-stroke-color": theme.stroke,
      "circle-opacity": 0.96,
    },
  });
}

export function updateVehicles(
  map: MapLibreMap,
  vehicles: VehiclePosition[],
  theme: ThemeDefinition,
): void {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(toFeatureCollection(vehicles, theme.modeColors));
  if (map.getLayer(LAYER_ID)) {
    map.setPaintProperty(LAYER_ID, "circle-stroke-color", theme.stroke);
  }
}
