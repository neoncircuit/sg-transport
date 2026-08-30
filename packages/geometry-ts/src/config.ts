/** Singapore island + nearby waters bounding box (S, W, N, E). */
export const SINGAPORE_BBOX = {
  south: 1.15,
  west: 103.6,
  north: 1.48,
  east: 104.1,
} as const;

export const OVERPASS_URL =
  process.env.OVERPASS_URL ?? "https://overpass.kumi.systems/api/interpreter";

/** Official-ish MRT/LRT colours for map styling (approx LTA palette). */
export const RAIL_LINE_COLORS: Record<string, string> = {
  NSL: "#d42e12",
  EWL: "#009645",
  CCL: "#fa9e0d",
  DTL: "#005ec4",
  TEL: "#9d5b25",
  NEL: "#9900aa",
  BPLRT: "#999999",
  SKLRT: "#748477",
  PGLRT: "#748477",
};

export function colourForRef(ref: string | undefined): string {
  if (!ref) return "#8899aa";
  const key = ref.toUpperCase().replace(/\s+/g, "");
  return RAIL_LINE_COLORS[key] ?? "#8899aa";
}
