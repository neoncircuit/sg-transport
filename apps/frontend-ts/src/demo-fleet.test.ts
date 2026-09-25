import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DemoFleet } from "./demo-fleet";

describe("DemoFleet", () => {
  it("returns inferred vehicles that drift between ticks", () => {
    const fleet = new DemoFleet();
    const a = fleet.tick(1_000);
    const b = fleet.tick(2_000);
    assert.ok(a.length >= 5);
    assert.ok(a.every((v) => v.isInferred));
    const moved = a.some((va, i) => va.lat !== b[i]?.lat || va.lon !== b[i]?.lon);
    assert.equal(moved, true);
  });
});
