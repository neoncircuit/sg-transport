import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isVehicleSnapshotMessage,
  type VehiclePosition,
  type VehicleSnapshotMessage,
} from "./index.js";

describe("VehiclePosition contract", () => {
  it("accepts a well-formed snapshot message", () => {
    const vehicle: VehiclePosition = {
      id: "bus-demo-1",
      mode: "bus",
      lat: 1.3521,
      lon: 103.8198,
      bearing: 90,
      observedAt: Date.now(),
      isInferred: true,
    };

    const msg: VehicleSnapshotMessage = {
      type: "snapshot",
      sentAt: Date.now(),
      vehicles: [vehicle],
    };

    assert.equal(isVehicleSnapshotMessage(msg), true);
  });

  it("rejects garbage", () => {
    assert.equal(isVehicleSnapshotMessage(null), false);
    assert.equal(isVehicleSnapshotMessage({ type: "ping" }), false);
  });
});
