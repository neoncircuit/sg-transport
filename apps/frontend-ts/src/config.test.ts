import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_MODES, MODE_LABELS } from "./config.js";

describe("mode labels", () => {
  it("covers every VehicleMode", () => {
    for (const mode of ALL_MODES) {
      assert.equal(typeof MODE_LABELS[mode], "string");
    }
  });
});
