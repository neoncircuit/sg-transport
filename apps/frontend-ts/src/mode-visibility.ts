import type { VehicleMode } from "@sg-transport/shared-types";
import { ALL_MODES } from "./config";

const STORAGE_KEY = "sg-live.mode-visibility";

/** Public transport on by default; air/sea off until the user opts in (battery). */
const DEFAULT_ENABLED: Record<VehicleMode, boolean> = {
  bus: true,
  mrt: true,
  lrt: true,
  plane: false,
  ship: false,
};

export type ModeVisibility = Record<VehicleMode, boolean>;

function isMode(value: unknown): value is VehicleMode {
  return typeof value === "string" && (ALL_MODES as string[]).includes(value);
}

export function defaultModeVisibility(): ModeVisibility {
  return { ...DEFAULT_ENABLED };
}

export function readStoredModeVisibility(): ModeVisibility {
  const base = defaultModeVisibility();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return base;
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isMode(key) && typeof value === "boolean") {
        base[key] = value;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return base;
}

export function writeStoredModeVisibility(visibility: ModeVisibility): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    /* private mode / quota */
  }
}

export function filterByModeVisibility(
  vehicles: { mode: VehicleMode }[],
  visibility: ModeVisibility,
): typeof vehicles {
  return vehicles.filter((v) => visibility[v.mode] !== false);
}
