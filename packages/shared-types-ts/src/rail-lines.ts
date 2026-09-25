/**
 * Singapore MRT/LRT line identity — colours approximate the LTA system map.
 * Operators run services; LTA owns the network.
 */

export type RailOperator = "SMRT" | "SBS Transit" | "LTA" | "Other";

/** Whether passenger service is running on the map today. */
export type RailServiceStatus = "open" | "construction" | "planned";

export interface RailLineInfo {
  /** Short code as used on maps / OSM `ref` (NSL, EWL, …). */
  ref: string;
  /** Short display name. */
  label: string;
  /** Approximate official map colour (hex). */
  colour: string;
  /** Day-to-day train operator (not the asset owner). */
  operator: RailOperator;
  /** subway vs light rail. */
  kind: "mrt" | "lrt";
  /**
   * open = simulate trains; construction/planned = geometry only
   * (no fake fleet) until revenue service starts.
   */
  status: RailServiceStatus;
}

/** Canonical catalogue — keep refs uppercase without spaces. */
export const RAIL_LINES: readonly RailLineInfo[] = [
  {
    ref: "NSL",
    label: "North–South Line",
    colour: "#DA291C",
    operator: "SMRT",
    kind: "mrt",
    status: "open",
  },
  {
    ref: "EWL",
    label: "East–West Line",
    colour: "#009739",
    operator: "SMRT",
    kind: "mrt",
    status: "open",
  },
  {
    ref: "NEL",
    label: "North East Line",
    colour: "#9B26B6",
    operator: "SBS Transit",
    kind: "mrt",
    status: "open",
  },
  {
    ref: "CCL",
    label: "Circle Line",
    colour: "#FF9E1B",
    operator: "SMRT",
    kind: "mrt",
    status: "open",
  },
  {
    ref: "DTL",
    label: "Downtown Line",
    colour: "#0057B7",
    operator: "SBS Transit",
    kind: "mrt",
    status: "open",
  },
  {
    ref: "TEL",
    label: "Thomson–East Coast Line",
    colour: "#9B5A1A",
    operator: "SMRT",
    kind: "mrt",
    status: "open",
  },
  {
    ref: "JRL",
    label: "Jurong Region Line",
    colour: "#089CAC",
    operator: "SMRT",
    kind: "mrt",
    status: "construction",
  },
  {
    ref: "CRL",
    label: "Cross Island Line",
    colour: "#A0C40C",
    operator: "LTA",
    kind: "mrt",
    status: "construction",
  },
  {
    ref: "CPE",
    label: "Cross Island Line (Punggol Extension)",
    colour: "#A0C40C",
    operator: "LTA",
    kind: "mrt",
    status: "construction",
  },
  {
    ref: "BPLRT",
    label: "Bukit Panjang LRT",
    colour: "#748477",
    operator: "SMRT",
    kind: "lrt",
    // Still in revenue service (system renewal / occasional Sunday closures —
    // not decommissioned).
    status: "open",
  },
  {
    ref: "SKLRT",
    label: "Sengkang LRT (East + West loops)",
    colour: "#708573",
    operator: "SBS Transit",
    kind: "lrt",
    status: "open",
  },
  {
    ref: "PGLRT",
    label: "Punggol LRT (East + West loops)",
    colour: "#708573",
    operator: "SBS Transit",
    kind: "lrt",
    status: "open",
  },
] as const;

const byRef = new Map(RAIL_LINES.map((line) => [line.ref, line] as const));

/** Common OSM / shorthand aliases → catalogue refs. */
const REF_ALIASES: Record<string, string> = {
  BP: "BPLRT",
  BPL: "BPLRT",
  SK: "SKLRT",
  SKL: "SKLRT",
  PG: "PGLRT",
  PGL: "PGLRT",
  JURONGREGIONALLINE: "JRL",
  JURONGREGIONLINE: "JRL",
  CROSSISLANDLINE: "CRL",
};

export function normalizeRailRef(ref: string | undefined | null): string {
  if (!ref) return "";
  const compact = ref.toUpperCase().replace(/[\s_-]+/g, "");
  return REF_ALIASES[compact] ?? compact;
}

export function railLineInfo(ref: string | undefined | null): RailLineInfo | undefined {
  return byRef.get(normalizeRailRef(ref));
}

/** Official colour when known; otherwise `fallback` or neutral grey. */
export function colourForRailRef(
  ref: string | undefined | null,
  fallback = "#8899aa",
): string {
  return railLineInfo(ref)?.colour ?? fallback;
}

export function operatorForRailRef(
  ref: string | undefined | null,
): RailOperator | undefined {
  return railLineInfo(ref)?.operator;
}

/** True when we should animate inferred trains on this line. */
export function isRailLineOpen(ref: string | undefined | null): boolean {
  const info = railLineInfo(ref);
  // Unknown refs (new OSM tags) stay open so we don't silently drop them.
  if (!info) return true;
  return info.status === "open";
}

export function railServiceStatus(ref: string | undefined | null): RailServiceStatus {
  return railLineInfo(ref)?.status ?? "open";
}
