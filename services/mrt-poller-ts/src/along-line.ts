/** WGS84 [lon, lat] along a LineString. */
export type LonLat = [number, number];

function haversineMeters(a: LonLat, b: LonLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(from: LonLat, to: LonLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(from[1]);
  const φ2 = toRad(to[1]);
  const Δλ = toRad(to[0] - from[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export interface AlongLineResult {
  lon: number;
  lat: number;
  bearing: number;
}

/**
 * Point at fraction `t` ∈ [0,1] along a polyline, plus heading of the
 * active segment. Used to slide simulated trains along OSM rail geometry.
 */
export function pointAlongLine(coords: LonLat[], t: number): AlongLineResult {
  if (coords.length === 0) {
    throw new Error("empty coordinate list");
  }
  if (coords.length === 1) {
    const [lon, lat] = coords[0]!;
    return { lon, lat, bearing: 0 };
  }

  const clamped = Math.min(1, Math.max(0, t));
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const len = haversineMeters(coords[i]!, coords[i + 1]!);
    segLens.push(len);
    total += len;
  }
  if (total === 0) {
    const [lon, lat] = coords[0]!;
    return { lon, lat, bearing: 0 };
  }

  let remaining = clamped * total;
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]!;
    if (remaining <= len || i === segLens.length - 1) {
      const a = coords[i]!;
      const b = coords[i + 1]!;
      const u = len === 0 ? 0 : remaining / len;
      return {
        lon: a[0] + (b[0] - a[0]) * u,
        lat: a[1] + (b[1] - a[1]) * u,
        bearing: bearingDegrees(a, b),
      };
    }
    remaining -= len;
  }

  const last = coords[coords.length - 1]!;
  const prev = coords[coords.length - 2]!;
  return { lon: last[0], lat: last[1], bearing: bearingDegrees(prev, last) };
}
