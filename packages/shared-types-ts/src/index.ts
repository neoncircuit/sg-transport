/** Transport mode used for styling and layer toggles. */
export type VehicleMode = "bus" | "mrt" | "lrt" | "plane" | "ship";

/**
 * A single vehicle's last-known state, normalized across all data sources.
 * Every poller must converge on this shape before hitting the state store.
 */
export interface VehiclePosition {
  /** Stable ID across updates (bus reg, ICAO24, MMSI, or synthetic train id). */
  id: string;
  /** Which layer this belongs to. */
  mode: VehicleMode;
  /** WGS84 latitude. */
  lat: number;
  /** WGS84 longitude. */
  lon: number;
  /** Heading in degrees, if known — used to orient the icon. */
  bearing?: number;
  /** Epoch ms this position was last confirmed (not last rendered). */
  observedAt: number;
  /**
   * True if lat/lon is interpolated or simulated rather than a direct GPS fix.
   * Phase 0 fake vehicles are always inferred.
   */
  isInferred: boolean;
}

/** Message the gateway broadcasts to connected map clients. */
export interface VehicleSnapshotMessage {
  type: "snapshot";
  /** Epoch ms the snapshot was assembled. */
  sentAt: number;
  vehicles: VehiclePosition[];
}

export function isVehicleSnapshotMessage(
  value: unknown,
): value is VehicleSnapshotMessage {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (
    msg.type === "snapshot" &&
    typeof msg.sentAt === "number" &&
    Array.isArray(msg.vehicles)
  );
}
