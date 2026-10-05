import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSingaporeClock,
  positionKindLabel,
  vehicleStatusLine,
} from "./map-chrome.js";

describe("formatSingaporeClock", () => {
  it("formats Asia/Singapore as 24-hour wall time", () => {
    assert.equal(
      formatSingaporeClock(new Date("2026-10-05T01:16:07.000Z")),
      "09:16:07",
    );
  });
});

describe("positionKindLabel", () => {
  it("marks a live bus as GPS and a live plane as ADS-B", () => {
    assert.equal(positionKindLabel({ mode: "bus", isInferred: false }), "GPS");
    assert.equal(positionKindLabel({ mode: "plane", isInferred: false }), "ADS-B");
    assert.equal(positionKindLabel({ mode: "ship", isInferred: false }), "AIS");
  });

  it("marks inferred trains as scheduled and other inferred vehicles as simulated", () => {
    assert.equal(positionKindLabel({ mode: "mrt", isInferred: true }), "scheduled");
    assert.equal(positionKindLabel({ mode: "lrt", isInferred: true }), "scheduled");
    assert.equal(positionKindLabel({ mode: "bus", isInferred: true }), "simulated");
  });
});

describe("vehicleStatusLine", () => {
  it("includes line, operator, id, and position kind", () => {
    assert.equal(
      vehicleStatusLine({
        id: "NSL-12",
        mode: "mrt",
        lineRef: "NSL",
        operator: "SMRT",
        isInferred: true,
      }),
      "MRT · NSL · SMRT · NSL-12 · scheduled",
    );
  });
});
