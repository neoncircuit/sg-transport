import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isVehicleSnapshotMessage,
  type VehiclePosition,
} from "@sg-transport/shared-types";
import WebSocket from "ws";
import { createGateway } from "./gateway.js";

function bus(id: string): VehiclePosition {
  return {
    id,
    mode: "bus",
    lat: 1.31,
    lon: 103.76,
    observedAt: Date.now(),
    isInferred: false,
  };
}

describe("ingest → websocket", () => {
  it("fans out poller vehicles to a WS client within a few seconds", async () => {
    const gateway = await createGateway({ tickMs: 200, staleMs: 10_000 }).listen(0);
    const base = `http://127.0.0.1:${gateway.port}`;

    try {
      const ingestRes = await fetch(`${base}/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "bus-poller",
          vehicles: [bus("integ-1"), bus("integ-2")],
        }),
      });
      assert.equal(ingestRes.status, 204);

      const health = (await (await fetch(`${base}/health`)).json()) as {
        sources: string[];
      };
      assert.deepEqual(health.sources, ["bus-poller"]);

      const msg = await new Promise<unknown>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${gateway.port}/ws`);
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error("timed out waiting for snapshot"));
        }, 3_000);
        ws.on("message", (data) => {
          clearTimeout(timer);
          resolve(JSON.parse(String(data)));
          ws.close();
        });
        ws.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      assert.equal(isVehicleSnapshotMessage(msg), true);
      if (!isVehicleSnapshotMessage(msg)) return;
      const ids = msg.vehicles.filter((v) => v.mode === "bus").map((v) => v.id);
      assert.ok(ids.includes("integ-1"));
      assert.ok(ids.includes("integ-2"));
      assert.equal(ids.includes("bus-demo-1"), false);
    } finally {
      await gateway.close();
    }
  });
});
