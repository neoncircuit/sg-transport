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
import { ensureStaticGeometryLayers } from "./static-layers";
import { HIT_LAYER_ID, ensureVehicleLayer, updateVehicles } from "./vehicles-layer";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const liveDotEl = document.querySelector<HTMLSpanElement>("#live-dot");
const themeSwatchesEl = document.querySelector<HTMLUListElement>("#theme-swatches");
const sheetEl = document.querySelector<HTMLElement>("#sheet");
const sheetBodyEl = document.querySelector<HTMLElement>("#sheet-body");
const sheetToggleEl = document.querySelector<HTMLButtonElement>("#sheet-toggle");
const locateBtn = document.querySelector<HTMLButtonElement>("#locate-btn");
const handleLabel = document.querySelector<HTMLElement>(".sheet-handle-label");

let activeTheme: ThemeDefinition = applyTheme(readStoredTheme());
let latestVehicles: VehiclePosition[] = [];
let socket: VehicleSocket | null = null;

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

function setSheetExpanded(expanded: boolean): void {
  if (!sheetEl || !sheetBodyEl || !sheetToggleEl) return;
  sheetEl.dataset.expanded = expanded ? "true" : "false";
  sheetBodyEl.hidden = !expanded;
  sheetToggleEl.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (handleLabel) handleLabel.textContent = expanded ? "Close" : "Details";
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

function centerOnMe(map: maplibregl.Map): void {
  if (!navigator.geolocation) {
    setStatus("Geolocation not available on this device");
    return;
  }
  locateBtn?.setAttribute("data-busy", "true");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locateBtn?.removeAttribute("data-busy");
      map.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: Math.max(map.getZoom(), 14),
        essential: true,
      });
      setStatus("Centered on you", true);
    },
    (err) => {
      locateBtn?.removeAttribute("data-busy");
      setStatus(
        err.code === err.PERMISSION_DENIED
          ? "Location permission denied"
          : "Couldn’t get your location",
      );
    },
    { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
  );
}

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP_STYLE,
  center: SINGAPORE_CENTER,
  zoom: SINGAPORE_ZOOM,
  pitch: 0,
  attributionControl: { compact: true },
  // Prefer touch gestures on phones
  dragRotate: false,
  pitchWithRotate: false,
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

renderThemeSwatches((id) => setTheme(id, map));
sheetToggleEl?.addEventListener("click", () => {
  const open = sheetEl?.dataset.expanded !== "true";
  setSheetExpanded(Boolean(open));
});
locateBtn?.addEventListener("click", () => centerOnMe(map));

map.on("load", () => {
  ensureVehicleLayer(map, activeTheme);
  void ensureStaticGeometryLayers(map);

  map.on("click", HIT_LAYER_ID, (e) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const id = String(feature.properties?.id ?? "");
    const mode = String(feature.properties?.mode ?? "");
    setStatus(`${mode.toUpperCase()} · ${id}`, true);
    setSheetExpanded(true);
  });

  // Tap empty map to collapse the sheet (more map, less chrome).
  map.on("click", (e) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: [HIT_LAYER_ID] });
    if (hits.length === 0 && sheetEl?.dataset.expanded === "true") {
      setSheetExpanded(false);
    }
  });

  socket = new VehicleSocket(
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

  document.addEventListener("visibilitychange", () => {
    socket?.setPaused(document.hidden);
  });

  window.addEventListener("beforeunload", () => socket?.close());
});

const params = new URLSearchParams(window.location.search);
const fromQuery = params.get("theme");
if (isThemeId(fromQuery) && fromQuery !== activeTheme.id) {
  setTheme(fromQuery, map);
}
