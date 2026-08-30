import {
  isVehicleSnapshotMessage,
  type VehiclePosition,
} from "@sg-transport/shared-types";

export type SnapshotHandler = (vehicles: VehiclePosition[]) => void;
export type StatusHandler = (status: "connecting" | "live" | "reconnecting" | "error") => void;

/**
 * Thin WebSocket client that reconnects with backoff and only forwards
 * well-formed snapshot messages. Designed for flaky mobile networks
 * (DESIGN §11): aggressive reconnect, and optional pause while the tab
 * is backgrounded to save battery.
 */
export class VehicleSocket {
  private socket: WebSocket | null = null;
  private closedByUser = false;
  private attempt = 0;
  private reconnectTimer: number | null = null;
  private paused = false;
  private lastVehicles: VehiclePosition[] = [];

  constructor(
    private readonly url: string,
    private readonly onSnapshot: SnapshotHandler,
    private readonly onStatus: StatusHandler,
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.onStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.attempt = 0;
      this.onStatus("live");
    });

    socket.addEventListener("message", (event) => {
      try {
        const data: unknown = JSON.parse(String(event.data));
        if (isVehicleSnapshotMessage(data)) {
          this.lastVehicles = data.vehicles;
          if (!this.paused) {
            this.onSnapshot(data.vehicles);
          }
        }
      } catch {
        // Ignore malformed frames; keep listening.
      }
    });

    socket.addEventListener("close", () => {
      if (this.closedByUser) return;
      this.onStatus("reconnecting");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      this.onStatus("error");
      socket.close();
    });
  }

  /** Stop applying map updates while backgrounded; keep the socket warm. */
  setPaused(paused: boolean): void {
    const wasPaused = this.paused;
    this.paused = paused;
    if (wasPaused && !paused && this.lastVehicles.length > 0) {
      this.onSnapshot(this.lastVehicles);
    }
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private scheduleReconnect(): void {
    this.attempt += 1;
    // Cap at 8s — mobile cellular flaps often; don't wait 10s+ to recover.
    const delay = Math.min(8_000, 400 * 2 ** Math.min(this.attempt, 4));
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }
}
