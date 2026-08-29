import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VehiclePosition } from "@sg-transport/shared-types";

describe("bus-poller stub contract", () => {
  it("can construct an empty VehiclePosition list", () => {
    const fleet: VehiclePosition[] = [];
    assert.equal(fleet.length, 0);
  });
});
