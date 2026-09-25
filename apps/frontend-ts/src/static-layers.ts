import {
  colourForRailRef,
  normalizeRailRef,
  railLineInfo,
} from "@sg-transport/shared-types";
import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

const RAIL_SOURCE = "static-rail";
const RAIL_CASING = "static-rail-casing";
const RAIL_LAYER = "static-rail-line";
const RAIL_LAYER_UC = "static-rail-line-uc";
const BUS_SOURCE = "static-bus";
const BUS_LAYER = "static-bus-line";
const BUS_STOPS_SOURCE = "static-bus-stops";
const BUS_STOPS_LAYER = "static-bus-stops-circle";

/**
 * Single muted slate for all bus route geometry — deliberately not in the
 * LTA MRT/LRT palette so the coloured train lines stay unambiguous.
 * Live bus *vehicles* keep the theme amber; only the static network uses this.
 */
export const BUS_NETWORK_COLOR = "#6b7785";
export const BUS_STOP_COLOR = "#5c6773";

function beforeVehicles(map: MapLibreMap): string | undefined {
  return map.getLayer("vehicles-glow") ? "vehicles-glow" : undefined;
}

/** Keep the bus web under rail casing + coloured lines. */
function beforeRail(map: MapLibreMap): string | undefined {
  if (map.getLayer(RAIL_CASING)) return RAIL_CASING;
  if (map.getLayer(RAIL_LAYER)) return RAIL_LAYER;
  return beforeVehicles(map);
}

/** MapLibre match expression: ref → official colour, else feature colour. */
export function railLineColorExpression(): unknown[] {
  const expr: unknown[] = ["match", ["get", "ref"]];
  for (const line of [
    "NSL",
    "EWL",
    "NEL",
    "CCL",
    "DTL",
    "TEL",
    "JRL",
    "CRL",
    "BPLRT",
    "SKLRT",
    "PGLRT",
  ]) {
    expr.push(line, colourForRailRef(line));
  }
  expr.push(["coalesce", ["get", "colour"], "#8899aa"]);
  return expr;
}

/**
 * Enrich rail features with official colour / operator when ref is known.
 * Safe to call on already-styled GeoJSON.
 */
export function enrichRailFeatureCollection(fc: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.map((feature) => {
      const props = { ...(feature.properties ?? {}) };
      const ref = normalizeRailRef(
        typeof props.ref === "string" ? props.ref : undefined,
      );
      const info = railLineInfo(ref);
      if (info) {
        props.ref = info.ref;
        props.colour = info.colour;
        props.operator = info.operator;
        props.status = info.status;
        if (!props.name) props.name = info.label;
      } else if (typeof props.ref === "string") {
        props.colour = colourForRailRef(
          props.ref,
          typeof props.colour === "string" ? props.colour : "#8899aa",
        );
        props.status = "open";
      }
      return { ...feature, properties: props };
    }),
  };
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
        const raw = (await res.json()) as FeatureCollection;
        const data = enrichRailFeatureCollection(raw);
        map.addSource(RAIL_SOURCE, { type: "geojson", data });
        const before = beforeVehicles(map);
        map.addLayer(
          {
            id: RAIL_CASING,
            type: "line",
            source: RAIL_SOURCE,
            filter: ["!=", ["get", "status"], "construction"],
            paint: {
              "line-color": "#2a3340",
              "line-width": 4.75,
              "line-opacity": 0.45,
            },
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
          },
          before,
        );
        map.addLayer(
          {
            id: RAIL_LAYER,
            type: "line",
            source: RAIL_SOURCE,
            filter: ["!=", ["get", "status"], "construction"],
            paint: {
              "line-color": railLineColorExpression() as never,
              "line-width": 2.75,
              "line-opacity": 0.95,
            },
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
          },
          before,
        );
        // Under-construction corridors: dashed + dimmer, no simulated trains.
        map.addLayer(
          {
            id: RAIL_LAYER_UC,
            type: "line",
            source: RAIL_SOURCE,
            filter: ["==", ["get", "status"], "construction"],
            paint: {
              "line-color": railLineColorExpression() as never,
              "line-width": 2.25,
              "line-opacity": 0.45,
              "line-dasharray": [2, 2],
            },
            layout: {
              "line-join": "round",
              "line-cap": "butt",
            },
          },
          before,
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
                "line-color": BUS_NETWORK_COLOR,
                "line-width": 1.75,
                "line-opacity": 0.42,
              },
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
            },
            beforeRail(map),
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
                "circle-radius": 2.75,
                "circle-color": BUS_STOP_COLOR,
                "circle-opacity": 0.55,
                "circle-stroke-width": 0.75,
                "circle-stroke-color": "#f4f6f8",
              },
            },
            map.getLayer(RAIL_CASING)
              ? RAIL_CASING
              : map.getLayer(RAIL_LAYER)
                ? RAIL_LAYER
                : beforeVehicles(map),
          );
        }
      }
    } catch {
      // optional
    }
  }
}

/** Unique rail refs present in a FeatureCollection (for legend). */
export function railRefsInCollection(fc: FeatureCollection): string[] {
  const refs = new Set<string>();
  for (const f of fc.features) {
    const ref = normalizeRailRef(
      typeof f.properties?.ref === "string" ? f.properties.ref : undefined,
    );
    if (ref) refs.add(ref);
  }
  return [...refs].sort();
}
