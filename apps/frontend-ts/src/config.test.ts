import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MODE_COLORS } from "./config.js";

describe("MODE_COLORS", () => {
  it("covers every VehicleMode", () => {
    for (const mode of ["bus", "mrt", "lrt", "plane", "ship"] as const) {
      assert.equal(typeof MODE_COLORS[mode], "string");
      assert.match(MODE_COLORS[mode], /^#/);
    }
  });
});
