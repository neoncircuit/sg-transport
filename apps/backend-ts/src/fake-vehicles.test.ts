import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeVehicleStore } from "./fake-vehicles.js";

describe("FakeVehicleStore", () => {
  it("returns inferred vehicles with stable ids", () => {
    const store = new FakeVehicleStore();
    const first = store.tick(1_000);
    const second = store.tick(2_000);

    assert.ok(first.length >= 5);
    assert.equal(first.every((v) => v.isInferred), true);
    assert.deepEqual(
      first.map((v) => v.id).sort(),
      second.map((v) => v.id).sort(),
    );
  });

  it("moves vehicles between ticks", () => {
    const store = new FakeVehicleStore();
    const a = store.tick(1_000);
    const b = store.tick(2_000);
    const moved = a.some((va) => {
      const vb = b.find((x) => x.id === va.id);
      return vb !== undefined && (vb.lat !== va.lat || vb.lon !== va.lon);
    });
    assert.equal(moved, true);
  });
});
