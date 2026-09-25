import { colourForRailRef } from "@sg-transport/shared-types";

/** Singapore island + nearby waters bounding box (S, W, N, E). */
export const SINGAPORE_BBOX = {
  south: 1.15,
  west: 103.6,
  north: 1.48,
  east: 104.1,
} as const;

export const OVERPASS_URL =
  process.env.OVERPASS_URL ?? "https://overpass.kumi.systems/api/interpreter";

/** @deprecated Prefer colourForRailRef from @sg-transport/shared-types. */
export const RAIL_LINE_COLORS: Record<string, string> = {
  NSL: colourForRailRef("NSL"),
  EWL: colourForRailRef("EWL"),
  CCL: colourForRailRef("CCL"),
  DTL: colourForRailRef("DTL"),
  TEL: colourForRailRef("TEL"),
  NEL: colourForRailRef("NEL"),
  JRL: colourForRailRef("JRL"),
  CRL: colourForRailRef("CRL"),
  BPLRT: colourForRailRef("BPLRT"),
  SKLRT: colourForRailRef("SKLRT"),
  PGLRT: colourForRailRef("PGLRT"),
};

export function colourForRef(ref: string | undefined): string {
  return colourForRailRef(ref);
}
