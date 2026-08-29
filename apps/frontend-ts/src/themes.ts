import type { VehicleMode } from "@sg-transport/shared-types";

export type ThemeId =
  | "harbour"
  | "cyberpunk"
  | "hacker"
  | "tron"
  | "gunmetal";

export interface ThemeDefinition {
  id: ThemeId;
  /** Short label for the picker. */
  label: string;
  /** One-line flavour for title/tooltip. */
  blurb: string;
  /** Dot colours for each transport mode. */
  modeColors: Record<VehicleMode, string>;
  /** Stroke behind vehicle circles (usually the void colour). */
  stroke: string;
}

export const DEFAULT_THEME: ThemeId = "harbour";
export const THEME_STORAGE_KEY = "sg-live-theme";

export const THEMES: ThemeDefinition[] = [
  {
    id: "harbour",
    label: "Harbour",
    blurb: "Night strait — warm amber & cool cyan",
    stroke: "#050b12",
    modeColors: {
      bus: "#f0a35e",
      mrt: "#e4574d",
      lrt: "#f08c3a",
      plane: "#5ec8e8",
      ship: "#7ed8d0",
    },
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    blurb: "Hot yellow on wet asphalt",
    stroke: "#0a0804",
    modeColors: {
      bus: "#ffe566",
      mrt: "#ff2a6d",
      lrt: "#ff9f1c",
      plane: "#05d9e8",
      ship: "#d1f7ff",
    },
  },
  {
    id: "hacker",
    label: "Hacker",
    blurb: "Terminal green phosphor",
    stroke: "#020805",
    modeColors: {
      bus: "#39ff14",
      mrt: "#00ff9f",
      lrt: "#b8ff66",
      plane: "#66ffcc",
      ship: "#9aff9a",
    },
  },
  {
    id: "tron",
    label: "Tron",
    blurb: "Grid blue light-cycles",
    stroke: "#02060e",
    modeColors: {
      bus: "#00e5ff",
      mrt: "#3d7eff",
      lrt: "#7af0ff",
      plane: "#e0f7ff",
      ship: "#4deeea",
    },
  },
  {
    id: "gunmetal",
    label: "Gunmetal",
    blurb: "Brushed steel & graphite",
    stroke: "#0c0e10",
    modeColors: {
      bus: "#c4ccd4",
      mrt: "#8b949e",
      lrt: "#e6edf3",
      plane: "#6e7a86",
      ship: "#a8b3bd",
    },
  },
];

const themeById = new Map(THEMES.map((t) => [t.id, t]));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && themeById.has(value as ThemeId);
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return themeById.get(id) ?? THEMES[0]!;
}

export function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(raw)) return raw;
  } catch {
    // private mode / blocked storage
  }
  return DEFAULT_THEME;
}

export function writeStoredTheme(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

/** Apply CSS theme tokens on <html> and return the definition. */
export function applyTheme(id: ThemeId): ThemeDefinition {
  const theme = getTheme(id);
  document.documentElement.dataset.theme = theme.id;
  writeStoredTheme(theme.id);
  return theme;
}
