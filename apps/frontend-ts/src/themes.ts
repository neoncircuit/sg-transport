import type { VehicleMode } from "@sg-transport/shared-types";

export type ThemeId =
  | "daylight"
  | "harbour"
  | "cyberpunk"
  | "hacker"
  | "tron"
  | "gunmetal";

export type BasemapKind = "light" | "dark";

export interface ThemeDefinition {
  id: ThemeId;
  /** Short label for the picker. */
  label: string;
  /** One-line flavour for title/tooltip. */
  blurb: string;
  /** OpenFreeMap style family — light for readable outlines, dark for night. */
  basemap: BasemapKind;
  /** Dot colours for each transport mode. */
  modeColors: Record<VehicleMode, string>;
  /** Stroke behind vehicle circles (contrast against the basemap). */
  stroke: string;
  /** Browser chrome / PWA theme-color. */
  themeColor: string;
}

/** Readable daytime default — outlines and labels land better on Liberty. */
export const DEFAULT_THEME: ThemeId = "daylight";
export const THEME_STORAGE_KEY = "sg-live-theme-v2";

export const THEMES: ThemeDefinition[] = [
  {
    id: "daylight",
    label: "Daylight",
    blurb: "Bright map — clear streets & outlines",
    basemap: "light",
    stroke: "#1a2330",
    themeColor: "#e8eef4",
    modeColors: {
      bus: "#c45c12",
      mrt: "#c62828",
      lrt: "#e65100",
      plane: "#0277bd",
      ship: "#00838f",
    },
  },
  {
    id: "harbour",
    label: "Harbour",
    blurb: "Night strait — warm amber & cool cyan",
    basemap: "dark",
    stroke: "#050b12",
    themeColor: "#050b12",
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
    basemap: "dark",
    stroke: "#0a0804",
    themeColor: "#0a0804",
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
    basemap: "dark",
    stroke: "#020805",
    themeColor: "#020805",
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
    basemap: "dark",
    stroke: "#02060e",
    themeColor: "#02060e",
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
    basemap: "dark",
    stroke: "#0c0e10",
    themeColor: "#0c0e10",
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

function syncThemeColorMeta(theme: ThemeDefinition): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme.themeColor;
}

/** Apply CSS theme tokens on <html> and return the definition. */
export function applyTheme(id: ThemeId): ThemeDefinition {
  const theme = getTheme(id);
  document.documentElement.dataset.theme = theme.id;
  writeStoredTheme(theme.id);
  syncThemeColorMeta(theme);
  return theme;
}
