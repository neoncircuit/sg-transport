import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildServiceLines, buildStopPoints } from "./bus-geojson.js";
import { loadValueDump } from "./lta-dump.js";

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

describe("buildStopPoints", () => {
  it("emits a Point per stop", () => {
    const fc = buildStopPoints([
      {
        BusStopCode: "01012",
        Latitude: 1.2968,
        Longitude: 103.8525,
        Description: "Hotel Grand Pacific",
      },
    ]);
    assert.equal(fc.features.length, 1);
    assert.equal(fc.features[0]!.geometry.type, "Point");
    assert.deepEqual(fc.features[0]!.geometry.coordinates, [103.8525, 1.2968]);
  });
});

describe("committed bus fixtures", () => {
  it("overlap enough to build at least one service line", async () => {
    const root = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/bus",
    );
    const stops = await loadValueDump<{
      BusStopCode: string;
      Latitude: number;
      Longitude: number;
    }>(path.join(root, "BusStops.json"));
    const routes = await loadValueDump<{
      ServiceNo: string;
      Direction: number;
      StopSequence: number;
      BusStopCode: string;
    }>(path.join(root, "BusRoutes.json"));
    const lines = buildServiceLines(stops, routes);
    assert.ok(lines.features.length >= 1);
    assert.ok(
      (lines.features[0]!.geometry.coordinates as number[][]).length >= 2,
    );
  });
});
