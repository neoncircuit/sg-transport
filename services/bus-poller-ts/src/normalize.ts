import type { VehiclePosition } from "@sg-transport/shared-types";

/** Subset of LTA DataMall Bus Arrival v3 fields we care about. */
export interface LtaNextBus {
  Latitude: string;
  Longitude: string;
  EstimatedArrival: string;
  /**
   * `1` = ETA from bus location; `0` = schedule-based (guide §2.1).
   * Absent on older sample dumps — treat as location-based when GPS present.
   */
  Monitored?: string | number;
}

export interface LtaBusService {
  ServiceNo: string;
  NextBus?: LtaNextBus;
  NextBus2?: LtaNextBus;
  NextBus3?: LtaNextBus;
}

export interface LtaBusArrivalResponse {
  BusStopCode: string;
  Services: LtaBusService[];
}

function parseCoord(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

function isMonitored(next: LtaNextBus): boolean {
  if (next.Monitored === undefined || next.Monitored === "") return true;
  return String(next.Monitored) !== "0";
}

function fromNextBus(
  stopCode: string,
  serviceNo: string,
  slot: number,
  next: LtaNextBus | undefined,
  now: number,
): VehiclePosition | null {
  if (!next) return null;
  const lat = parseCoord(next.Latitude);
  const lon = parseCoord(next.Longitude);
  if (lat === null || lon === null) return null;

  return {
    id: `bus-${serviceNo}-${stopCode}-${slot}`,
    mode: "bus",
    lat,
    lon,
    observedAt: now,
    // Schedule-only ETAs (Monitored=0) are not a live GPS fix.
    isInferred: !isMonitored(next),
  };
}

/**
 * Normalize a DataMall Bus Arrival payload into VehiclePosition[].
 * Ready for the live client once LTA_ACCOUNT_KEY is available.
 */
export function normalizeBusArrival(
  payload: LtaBusArrivalResponse,
  now = Date.now(),
): VehiclePosition[] {
  const out: VehiclePosition[] = [];
  for (const service of payload.Services) {
    const slots: Array<LtaNextBus | undefined> = [
      service.NextBus,
      service.NextBus2,
      service.NextBus3,
    ];
    slots.forEach((next, i) => {
      const vehicle = fromNextBus(
        payload.BusStopCode,
        service.ServiceNo,
        i + 1,
        next,
        now,
      );
      if (vehicle) out.push(vehicle);
    });
  }
  return out;
}
