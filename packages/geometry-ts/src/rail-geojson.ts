import type {
  Feature,
  FeatureCollection,
  LineString,
  Position,
} from "geojson";
import { colourForRef } from "./config.js";
import type {
  OverpassElement,
  OverpassNode,
  OverpassRelation,
  OverpassResponse,
  OverpassWay,
} from "./overpass.js";

function isNode(el: OverpassElement): el is OverpassNode {
  return el.type === "node";
}
function isWay(el: OverpassElement): el is OverpassWay {
  return el.type === "way";
}
function isRelation(el: OverpassElement): el is OverpassRelation {
  return el.type === "relation";
}

/**
 * Convert Overpass route relations into a FeatureCollection of LineStrings.
 * Each relation becomes one MultiLine-merged LineString (concatenated way
 * segments in member order) when possible; otherwise multiple features share
 * the same ref/name properties.
 */
export function overpassRailToGeoJSON(
  data: OverpassResponse,
): FeatureCollection {
  const nodes = new Map<number, OverpassNode>();
  const ways = new Map<number, OverpassWay>();
  const relations: OverpassRelation[] = [];

  for (const el of data.elements) {
    if (isNode(el)) nodes.set(el.id, el);
    else if (isWay(el)) ways.set(el.id, el);
    else if (isRelation(el)) relations.push(el);
  }

  const features: Feature<LineString>[] = [];

  for (const rel of relations) {
    const ref = rel.tags?.ref ?? rel.tags?.name ?? `rel-${rel.id}`;
    const name = rel.tags?.name ?? ref;
    const route = rel.tags?.route ?? "subway";
    const colour = rel.tags?.colour ?? colourForRef(rel.tags?.ref);

    const segments: Position[][] = [];
    for (const member of rel.members) {
      if (member.type !== "way") continue;
      if (member.role === "platform" || member.role === "stop") continue;
      const way = ways.get(member.ref);
      if (!way) continue;
      const coords: Position[] = [];
      for (const nodeId of way.nodes) {
        const node = nodes.get(nodeId);
        if (!node) continue;
        coords.push([node.lon, node.lat]);
      }
      if (coords.length >= 2) segments.push(coords);
    }

    const merged = mergeSegments(segments);
    for (const line of merged) {
      features.push({
        type: "Feature",
        properties: {
          id: `osm-rel-${rel.id}`,
          ref,
          name,
          route,
          colour,
          source: "osm-overpass",
        },
        geometry: { type: "LineString", coordinates: line },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

/** Greedy merge of polylines that share endpoints (within ~1e-6 deg). */
function mergeSegments(segments: Position[][]): Position[][] {
  if (segments.length === 0) return [];
  const remaining = segments.map((s) => [...s]);
  const out: Position[][] = [];

  while (remaining.length > 0) {
    let chain = remaining.shift()!;
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i]!;
        const head = chain[0]!;
        const tail = chain[chain.length - 1]!;
        const segHead = seg[0]!;
        const segTail = seg[seg.length - 1]!;

        if (near(tail, segHead)) {
          chain = chain.concat(seg.slice(1));
          remaining.splice(i, 1);
          grew = true;
          break;
        }
        if (near(tail, segTail)) {
          chain = chain.concat(seg.slice(0, -1).reverse());
          remaining.splice(i, 1);
          grew = true;
          break;
        }
        if (near(head, segTail)) {
          chain = seg.slice(0, -1).concat(chain);
          remaining.splice(i, 1);
          grew = true;
          break;
        }
        if (near(head, segHead)) {
          chain = seg.slice(1).reverse().concat(chain);
          remaining.splice(i, 1);
          grew = true;
          break;
        }
      }
    }
    if (chain.length >= 2) out.push(chain);
  }
  return out;
}

function near(a: Position, b: Position): boolean {
  return Math.abs(a[0]! - b[0]!) < 1e-6 && Math.abs(a[1]! - b[1]!) < 1e-6;
}
