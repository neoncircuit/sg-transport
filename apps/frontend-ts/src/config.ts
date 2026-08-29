import type { VehicleMode } from "@sg-transport/shared-types";

/** Layer colours — distinct enough on a dark basemap. */
export const MODE_COLORS: Record<VehicleMode, string> = {
  bus: "#f4a261",
  mrt: "#e63946",
  lrt: "#f77f00",
  plane: "#4cc9f0",
  ship: "#90e0ef",
};

export const SINGAPORE_CENTER: [number, number] = [103.8198, 1.3521];
export const SINGAPORE_ZOOM = 11;

/** OpenFreeMap dark style (Protomaps-based, no API key). */
export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}
