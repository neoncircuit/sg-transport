import type { VehicleMode, VehiclePosition } from "@sg-transport/shared-types";
import { railLineInfo } from "@sg-transport/shared-types";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ALL_MODES,
  basemapStyleFor,
  MODE_LABELS,
  SINGAPORE_CENTER,
  SINGAPORE_ZOOM,
  wsUrl,
} from "./config";
import {
  filterByModeVisibility,
  type ModeVisibility,
  readStoredModeVisibility,
  writeStoredModeVisibility,
} from "./mode-visibility";
import {
  enrichRailFeatureCollection,
  ensureStaticGeometryLayers,
  railRefsInCollection,
} from "./static-layers";
import {
  applyTheme,
  isThemeId,
  readStoredTheme,
  THEMES,
  type ThemeDefinition,
  type ThemeId,
} from "./themes";
import { VehicleSocket } from "./vehicle-socket";
import { ensureVehicleLayer, HIT_LAYER_ID, updateVehicles } from "./vehicles-layer";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const liveDotEl = document.querySelector<HTMLSpanElement>("#live-dot");
const themeSwatchesEl = document.querySelector<HTMLElement>("#theme-swatches");
const railLegendEl = document.querySelector<HTMLUListElement>("#rail-legend");
const legendEl = document.querySelector<HTMLElement>("#legend");
const sheetEl = document.querySelector<HTMLElement>("#sheet");
const sheetBodyEl = document.querySelector<HTMLElement>("#sheet-body");
const sheetToggleEl = document.querySelector<HTMLButtonElement>("#sheet-toggle");
const locateBtn = document.querySelector<HTMLButtonElement>("#locate-btn");
const handleLabel = document.querySelector<HTMLElement>(".sheet-handle-label");
const versionBadgeEl = document.querySelector<HTMLElement>("#version-badge");

let activeTheme: ThemeDefinition = applyTheme(readStoredTheme());
let latestVehicles: VehiclePosition[] = [];
let modeVisibility: ModeVisibility = readStoredModeVisibility();
let socket: VehicleSocket | null = null;
let remountingStyle = false;

if (versionBadgeEl) {
  versionBadgeEl.textContent = __APP_VERSION_BADGE__;
  versionBadgeEl.title = `${__APP_VERSION__} (${__GIT_SHA__})`;
}

function fleetStatusLabel(vehicles: VehiclePosition[]): string {
  const live = vehicles.filter((v) => !v.isInferred).length;
  const inferred = vehicles.length - live;
  if (vehicles.length === 0) return "No vehicles · waiting";
  if (live > 0 && inferred > 0) {
    return `${live} live · ${inferred} inferred · updating`;
  }
  if (live > 0) return `${live} live · updating`;
  return `${inferred} inferred · updating`;
}

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

function paintVehicles(map: maplibregl.Map, vehicles: VehiclePosition[]): void {
  updateVehicles(
    map,
    filterByModeVisibility(vehicles, modeVisibility) as VehiclePosition[],
    activeTheme,
  );
}

function syncModeToggleUi(): void {
  if (!legendEl) return;
  for (const mode of ALL_MODES) {
    const btn = legendEl.querySelector<HTMLElement>(`[data-mode="${mode}"]`);
    if (!btn) continue;
    const on = modeVisibility[mode] !== false;
    btn.classList.toggle("off", !on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const label = MODE_LABELS[mode];
    btn.title = on ? `Hide ${label}` : `Show ${label}`;
  }
}

function wireModeToggles(map: maplibregl.Map): void {
  if (!legendEl) return;
  for (const mode of ALL_MODES) {
    const btn = legendEl.querySelector<HTMLElement>(`[data-mode="${mode}"]`);
    if (!btn) continue;
    const toggle = () => {
      modeVisibility = {
        ...modeVisibility,
        [mode]: !modeVisibility[mode],
      };
      writeStoredModeVisibility(modeVisibility);
      syncModeToggleUi();
      if (!remountingStyle) paintVehicles(map, latestVehicles);
    };
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggle();
    });
  }
  syncModeToggleUi();
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
  for (const btn of themeSwatchesEl.querySelectorAll<HTMLButtonElement>(
    ".theme-swatch",
  )) {
    const id = btn.dataset.themeId;
    btn.setAttribute("aria-checked", id === selected ? "true" : "false");
  }
}

function renderThemeSwatches(onSelect: (id: ThemeId) => void): void {
  if (!themeSwatchesEl) return;
  themeSwatchesEl.replaceChildren();

  for (const theme of THEMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-swatch";
    btn.dataset.themeId = theme.id;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", theme.id === activeTheme.id ? "true" : "false");
    btn.title = `${theme.label} — ${theme.blurb}`;
    btn.setAttribute("aria-label", `${theme.label}: ${theme.blurb}`);
    btn.addEventListener("click", () => onSelect(theme.id));
    themeSwatchesEl.append(btn);
  }
}

function mountOverlayLayers(map: maplibregl.Map): void {
  ensureVehicleLayer(map, activeTheme);
  void ensureStaticGeometryLayers(map).then(() => {
    paintVehicles(map, latestVehicles);
  });
  paintVehicles(map, latestVehicles);
}

function renderRailLegend(refs: string[]): void {
  if (!railLegendEl) return;
  railLegendEl.replaceChildren();
  for (const ref of refs) {
    const info = railLineInfo(ref);
    const li = document.createElement("li");
    if (info?.status === "construction" || info?.status === "planned") {
      li.classList.add("rail-uc");
    }
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    const colour = info?.colour ?? "#8899aa";
    swatch.style.setProperty("--swatch", colour);
    swatch.style.background = colour;
    const code = document.createElement("span");
    code.className = "rail-ref";
    code.textContent = ref;
    code.title = info?.label ?? ref;
    const op = document.createElement("span");
    op.className = "rail-op";
    if (info?.status === "construction") {
      op.textContent = "U/C";
      op.title = "Under construction — shown on map, no simulated trains";
    } else if (info?.status === "planned") {
      op.textContent = "planned";
    } else {
      op.textContent = info?.operator ?? "";
    }
    li.append(swatch, code, op);
    railLegendEl.append(li);
  }
}

async function loadRailLegend(): Promise<void> {
  try {
    const res = await fetch("/geometry/rail.geojson");
    if (!res.ok) return;
    const fc = enrichRailFeatureCollection(await res.json());
    renderRailLegend(railRefsInCollection(fc));
  } catch {
    // geometry optional at boot
  }
}

function setTheme(id: ThemeId, map: maplibregl.Map | null): void {
  const previous = activeTheme;
  activeTheme = applyTheme(id);
  syncThemeSwatches(id);
  if (!map) return;

  const nextStyle = basemapStyleFor(activeTheme.basemap);
  const prevStyle = basemapStyleFor(previous.basemap);
  if (nextStyle !== prevStyle) {
    remountingStyle = true;
    map.setStyle(nextStyle);
    map.once("style.load", () => {
      remountingStyle = false;
      mountOverlayLayers(map);
    });
    return;
  }

  if (map.isStyleLoaded() && !remountingStyle) {
    paintVehicles(map, latestVehicles);
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
  style: basemapStyleFor(activeTheme.basemap),
  center: SINGAPORE_CENTER,
  zoom: SINGAPORE_ZOOM,
  pitch: 0,
  attributionControl: { compact: true },
  // Prefer touch gestures on phones
  dragRotate: false,
  pitchWithRotate: false,
});

map.addControl(
  new maplibregl.NavigationControl({ visualizePitch: false }),
  "top-right",
);

renderThemeSwatches((id) => setTheme(id, map));
wireModeToggles(map);
sheetToggleEl?.addEventListener("click", () => {
  const open = sheetEl?.dataset.expanded !== "true";
  setSheetExpanded(Boolean(open));
});
locateBtn?.addEventListener("click", () => centerOnMe(map));

map.on("load", () => {
  mountOverlayLayers(map);
  void loadRailLegend();

  map.on("click", HIT_LAYER_ID, (e) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const id = String(feature.properties?.id ?? "");
    const mode = String(feature.properties?.mode ?? "");
    const lineRef = String(feature.properties?.lineRef ?? "");
    const operator = String(feature.properties?.operator ?? "");
    const bits = [mode.toUpperCase()];
    if (lineRef) bits.push(lineRef);
    if (operator) bits.push(operator);
    bits.push(id);
    setStatus(bits.join(" · "), true);
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
      if (!remountingStyle) {
        paintVehicles(map, vehicles);
      }
      updateLegend(vehicles);
      setStatus(fleetStatusLabel(vehicles), true);
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
