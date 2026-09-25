import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultModeVisibility, filterByModeVisibility } from "./mode-visibility.js";

describe("mode-visibility", () => {
  it("defaults bus/train on and plane/ship off", () => {
    const v = defaultModeVisibility();
    assert.equal(v.bus, true);
    assert.equal(v.mrt, true);
    assert.equal(v.lrt, true);
    assert.equal(v.plane, false);
    assert.equal(v.ship, false);
  });

  it("filters vehicles by visibility map", () => {
    const vehicles = [
      { mode: "bus" as const },
      { mode: "plane" as const },
      { mode: "mrt" as const },
    ];
    const filtered = filterByModeVisibility(vehicles, {
      bus: true,
      mrt: true,
      lrt: true,
      plane: false,
      ship: false,
    });
    assert.deepEqual(
      filtered.map((v) => v.mode),
      ["bus", "mrt"],
    );
  });
});
