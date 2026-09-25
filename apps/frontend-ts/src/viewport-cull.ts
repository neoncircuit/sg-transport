import type { VehiclePosition } from "@sg-transport/shared-types";

export interface LngLatBoundsLike {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}

/**
 * Drop vehicles outside the visible map (plus padding) so GeoJSON updates
 * stay cheap when AIS/ADS-B fleets are dense.
 */
export function cullToViewport(
  vehicles: VehiclePosition[],
  bounds: LngLatBoundsLike,
  padFraction = 0.2,
): VehiclePosition[] {
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  const padLon = Math.max(0, (east - west) * padFraction);
  const padLat = Math.max(0, (north - south) * padFraction);
  const minLon = west - padLon;
  const maxLon = east + padLon;
  const minLat = south - padLat;
  const maxLat = north + padLat;

  return vehicles.filter(
    (v) => v.lon >= minLon && v.lon <= maxLon && v.lat >= minLat && v.lat <= maxLat,
  );
}
