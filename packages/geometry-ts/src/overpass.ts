import { OVERPASS_URL, SINGAPORE_BBOX } from "./config.js";

export interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}

export interface OverpassWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export interface OverpassRelation {
  type: "relation";
  id: number;
  members: Array<{ type: string; ref: number; role: string }>;
  tags?: Record<string, string>;
}

export type OverpassElement = OverpassNode | OverpassWay | OverpassRelation;

export interface OverpassResponse {
  elements: OverpassElement[];
}

const OVERPASS_FALLBACKS = [
  OVERPASS_URL,
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** Overpass QL: Singapore subway + light_rail route relations with full geometry. */
export function railRoutesQuery(): string {
  const { south, west, north, east } = SINGAPORE_BBOX;
  return `
[out:json][timeout:180];
(
  relation["type"="route"]["route"="subway"](${south},${west},${north},${east});
  relation["type"="route"]["route"="light_rail"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`.trim();
}

export async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const endpoints = [...new Set(OVERPASS_FALLBACKS)];
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      console.log(`[geometry] Overpass try ${endpoint}`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          accept: "application/json",
          "user-agent":
            "sg-transport-geometry/0.1 (https://github.com/neoncircuit/sg-transport)",
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (!res.ok) {
        lastError = new Error(
          `Overpass HTTP ${res.status} @ ${endpoint}: ${await res.text()}`,
        );
        continue;
      }
      return (await res.json()) as OverpassResponse;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Overpass failed"));
}
