import type { VehicleMode } from "@sg-transport/shared-types";

const SINGAPORE_CLOCK = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall clock in Asia/Singapore, `HH:mm:ss`. */
export function formatSingaporeClock(date: Date): string {
  return SINGAPORE_CLOCK.format(date);
}

export interface PositionKindInput {
  mode: VehicleMode;
  isInferred: boolean;
}

/**
 * How the position was obtained. Inferred trains are scheduled;
 * inferred buses in the demo are simulated; a live plane is ADS-B.
 */
export function positionKindLabel(vehicle: PositionKindInput): string {
  if (!vehicle.isInferred) {
    if (vehicle.mode === "plane") return "ADS-B";
    if (vehicle.mode === "ship") return "AIS";
    return "GPS";
  }
  if (vehicle.mode === "mrt" || vehicle.mode === "lrt") return "scheduled";
  return "simulated";
}

export interface VehicleStatusInput extends PositionKindInput {
  id: string;
  lineRef?: string;
  operator?: string;
}

/** One-line description for the sheet when a vehicle is selected. */
export function vehicleStatusLine(vehicle: VehicleStatusInput): string {
  const bits = [vehicle.mode.toUpperCase()];
  if (vehicle.lineRef) bits.push(vehicle.lineRef);
  if (vehicle.operator) bits.push(vehicle.operator);
  bits.push(vehicle.id, positionKindLabel(vehicle));
  return bits.join(" · ");
}
