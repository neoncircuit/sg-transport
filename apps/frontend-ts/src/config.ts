import type { VehicleMode } from "@sg-transport/shared-types";

export const MODE_LABELS: Record<VehicleMode, string> = {
  bus: "Bus",
  mrt: "MRT",
  lrt: "LRT",
  plane: "Air",
  ship: "Sea",
};

export const ALL_MODES: VehicleMode[] = ["bus", "mrt", "lrt", "plane", "ship"];

export const SINGAPORE_CENTER: [number, number] = [103.8198, 1.3521];
export const SINGAPORE_ZOOM = 11;

export const BASEMAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
export const BASEMAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";

/** Dark basemap URL (legacy alias). Prefer basemapStyleFor. */
export const BASEMAP_STYLE = BASEMAP_STYLE_DARK;

export function basemapStyleFor(kind: "light" | "dark"): string {
  return kind === "light" ? BASEMAP_STYLE_LIGHT : BASEMAP_STYLE_DARK;
}

export function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}
