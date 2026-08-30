import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VehiclePosition } from "@sg-transport/shared-types";
import { VehicleStore } from "./vehicle-store.js";

function bus(id: string, lat = 1.3, lon = 103.85): VehiclePosition {
  return {
    id,
    mode: "bus",
    lat,
    lon,
    observedAt: 1_000,
    isInferred: true,
  };
}

describe("VehicleStore", () => {
  it("falls back to the fake fleet when nothing is ingested", () => {
    const store = new VehicleStore();
    const vehicles = store.snapshot(1_000);
    assert.ok(vehicles.some((v) => v.mode === "bus"));
    assert.ok(vehicles.some((v) => v.mode === "mrt"));
  });

  it("replaces fake buses when bus-poller is fresh", () => {
    const store = new VehicleStore(10_000);
    store.ingest("bus-poller", [bus("skel-1"), bus("skel-2")], 5_000);
    const vehicles = store.snapshot(5_000);

    const buses = vehicles.filter((v) => v.mode === "bus");
    assert.deepEqual(
      buses.map((v) => v.id).sort(),
      ["skel-1", "skel-2"],
    );
    assert.ok(vehicles.some((v) => v.mode === "mrt"));
  });

  it("drops stale poller snapshots and returns to fake buses", () => {
    const store = new VehicleStore(1_000);
    store.ingest("bus-poller", [bus("skel-1")], 1_000);
    const vehicles = store.snapshot(5_000);
    assert.ok(vehicles.some((v) => v.id === "bus-demo-1"));
    assert.equal(
      vehicles.some((v) => v.id === "skel-1"),
      false,
    );
  });
});
