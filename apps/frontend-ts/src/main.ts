import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ALL_MODES,
  BASEMAP_STYLE,
  SINGAPORE_CENTER,
  SINGAPORE_ZOOM,
  wsUrl,
} from "./config";
import {
  THEMES,
  applyTheme,
  isThemeId,
  readStoredTheme,
  type ThemeDefinition,
  type ThemeId,
} from "./themes";
import { VehicleSocket } from "./vehicle-socket";
import { ensureVehicleLayer, updateVehicles } from "./vehicles-layer";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const liveDotEl = document.querySelector<HTMLSpanElement>("#live-dot");
const themeSwatchesEl = document.querySelector<HTMLUListElement>("#theme-swatches");

let activeTheme: ThemeDefinition = applyTheme(readStoredTheme());
let latestVehicles: VehiclePosition[] = [];

function setStatus(text: string, live = false): void {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("live", live);
  liveDotEl?.classList.toggle("on", live);
}

function countByMode(vehicles: VehiclePosition[]): Record<VehicleMode, number> {
  const counts = Object.fromEntries(ALL_MODES.map((m) => [m, 0])) as Record<
    VehicleMode,
    number
  >;
  for (const v of vehicles) {
    counts[v.mode] += 1;
  }
  return counts;
}

function updateLegend(vehicles: VehiclePosition[]): void {
  const counts = countByMode(vehicles);
  for (const mode of ALL_MODES) {
    const el = document.querySelector<HTMLElement>(`#count-${mode}`);
    if (el) el.textContent = String(counts[mode]);
  }
}

function syncThemeSwatches(selected: ThemeId): void {
  if (!themeSwatchesEl) return;
  for (const btn of themeSwatchesEl.querySelectorAll<HTMLButtonElement>(".theme-swatch")) {
    const id = btn.dataset.themeId;
    btn.setAttribute("aria-checked", id === selected ? "true" : "false");
  }
}

function renderThemeSwatches(onSelect: (id: ThemeId) => void): void {
  if (!themeSwatchesEl) return;
  themeSwatchesEl.replaceChildren();

  for (const theme of THEMES) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-swatch";
    btn.dataset.themeId = theme.id;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", theme.id === activeTheme.id ? "true" : "false");
    btn.title = `${theme.label} — ${theme.blurb}`;
    btn.setAttribute("aria-label", `${theme.label}: ${theme.blurb}`);
    btn.addEventListener("click", () => onSelect(theme.id));
    li.append(btn);
    themeSwatchesEl.append(li);
  }
}

function setTheme(id: ThemeId, map: maplibregl.Map | null): void {
  activeTheme = applyTheme(id);
  syncThemeSwatches(id);
  if (map?.isStyleLoaded()) {
    updateVehicles(map, latestVehicles, activeTheme);
  }
}

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP_STYLE,
  center: SINGAPORE_CENTER,
  zoom: SINGAPORE_ZOOM,
  pitch: 0,
  attributionControl: { compact: true },
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

renderThemeSwatches((id) => setTheme(id, map));

map.on("load", () => {
  ensureVehicleLayer(map, activeTheme);

  const socket = new VehicleSocket(
    wsUrl(),
    (vehicles) => {
      latestVehicles = vehicles;
      updateVehicles(map, vehicles, activeTheme);
      updateLegend(vehicles);
      setStatus(`${vehicles.length} simulated · updating`, true);
    },
    (status) => {
      switch (status) {
        case "connecting":
          setStatus("Connecting to gateway…");
          break;
        case "live":
          setStatus("Gateway connected", true);
          break;
        case "reconnecting":
          setStatus("Reconnecting…");
          break;
        case "error":
          setStatus("Gateway error — retrying");
          break;
      }
    },
  );

  socket.connect();

  window.addEventListener("beforeunload", () => socket.close());
});

// Deep-link / bookmark: ?theme=tron
const params = new URLSearchParams(window.location.search);
const fromQuery = params.get("theme");
if (isThemeId(fromQuery) && fromQuery !== activeTheme.id) {
  setTheme(fromQuery, map);
}
