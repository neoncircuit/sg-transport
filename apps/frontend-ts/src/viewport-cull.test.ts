import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VehiclePosition } from "@sg-transport/shared-types";
import { cullToViewport } from "./viewport-cull";

function v(id: string, lat: number, lon: number): VehiclePosition {
  return {
    id,
    mode: "bus",
    lat,
    lon,
    observedAt: 1,
    isInferred: false,
  };
}

describe("cullToViewport", () => {
  it("keeps points inside padded bounds", () => {
    const bounds = {
      getWest: () => 103.8,
      getSouth: () => 1.3,
      getEast: () => 103.9,
      getNorth: () => 1.4,
    };
    const fleet = [v("in", 1.35, 103.85), v("out", 1.5, 103.85), v("edge", 1.3, 103.8)];
    const kept = cullToViewport(fleet, bounds, 0.1).map((x) => x.id);
    assert.deepEqual(kept, ["in", "edge"]);
  });
});
