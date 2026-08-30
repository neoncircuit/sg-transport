import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { ThemeDefinition } from "./themes";

const SOURCE_ID = "vehicles";
const GLOW_LAYER_ID = "vehicles-glow";
const LAYER_ID = "vehicles-circle";
/** Invisible larger hit area for reliable mobile taps (DESIGN §11). */
export const HIT_LAYER_ID = "vehicles-hit";

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
      "circle-stroke-width": [
        "case",
        ["==", ["to-boolean", ["get", "isInferred"]], true],
        2,
        1.25,
      ],
      "circle-stroke-color": theme.stroke,
      "circle-opacity": [
        "case",
        ["==", ["to-boolean", ["get", "isInferred"]], true],
        0.62,
        0.96,
      ],
    },
  });

  map.addLayer({
    id: HIT_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": 18,
      "circle-opacity": 0,
      "circle-color": "#000000",
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
