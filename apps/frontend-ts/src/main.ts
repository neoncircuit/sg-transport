import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BASEMAP_STYLE,
  SINGAPORE_CENTER,
  SINGAPORE_ZOOM,
  wsUrl,
} from "./config";
import { VehicleSocket } from "./vehicle-socket";
import { ensureVehicleLayer, updateVehicles } from "./vehicles-layer";

const statusEl = document.querySelector<HTMLParagraphElement>("#status");

function setStatus(text: string, live = false): void {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("live", live);
}

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP_STYLE,
  center: SINGAPORE_CENTER,
  zoom: SINGAPORE_ZOOM,
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

map.on("load", () => {
  ensureVehicleLayer(map);

  const socket = new VehicleSocket(
    wsUrl(),
    (vehicles) => {
      updateVehicles(map, vehicles);
      setStatus(`${vehicles.length} simulated vehicles · live`, true);
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
