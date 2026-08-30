import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildServiceLines } from "./bus-geojson.js";

describe("buildServiceLines", () => {
  it("joins stop sequences into a LineString per service/direction", () => {
    const fc = buildServiceLines(
      [
        { BusStopCode: "A", Latitude: 1.3, Longitude: 103.8 },
        { BusStopCode: "B", Latitude: 1.31, Longitude: 103.81 },
        { BusStopCode: "C", Latitude: 1.32, Longitude: 103.82 },
      ],
      [
        { ServiceNo: "10", Direction: 1, StopSequence: 1, BusStopCode: "A" },
        { ServiceNo: "10", Direction: 1, StopSequence: 2, BusStopCode: "B" },
        { ServiceNo: "10", Direction: 1, StopSequence: 3, BusStopCode: "C" },
      ],
    );
    assert.equal(fc.features.length, 1);
    assert.equal(fc.features[0]!.properties?.serviceNo, "10");
    assert.equal(fc.features[0]!.geometry.coordinates.length, 3);
  });
});
