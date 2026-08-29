import {
  isVehicleSnapshotMessage,
  type VehiclePosition,
} from "@sg-transport/shared-types";

export type SnapshotHandler = (vehicles: VehiclePosition[]) => void;
export type StatusHandler = (status: "connecting" | "live" | "reconnecting" | "error") => void;

/**
 * Thin WebSocket client that reconnects with backoff and only forwards
 * well-formed snapshot messages.
 */
export class VehicleSocket {
  private socket: WebSocket | null = null;
  private closedByUser = false;
  private attempt = 0;
  private reconnectTimer: number | null = null;

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
          this.onSnapshot(data.vehicles);
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
    const delay = Math.min(10_000, 500 * 2 ** Math.min(this.attempt, 4));
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }
}
