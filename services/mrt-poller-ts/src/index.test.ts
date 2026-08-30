import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pointAlongLine } from "./along-line.js";
import {
  railLinesFromGeoJSON,
  seedTrains,
  tickTrains,
} from "./simulate.js";

describe("pointAlongLine", () => {
  it("returns endpoints at t=0 and t=1", () => {
    const coords: [number, number][] = [
      [103.8, 1.3],
      [103.81, 1.3],
      [103.82, 1.31],
    ];
    const a = pointAlongLine(coords, 0);
    const b = pointAlongLine(coords, 1);
    assert.equal(a.lon, 103.8);
    assert.equal(a.lat, 1.3);
    assert.equal(b.lon, 103.82);
    assert.equal(b.lat, 1.31);
  });
});

describe("simulate", () => {
  it("builds inferred trains from rail GeoJSON", () => {
    const lines = railLinesFromGeoJSON({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: "osm-1", ref: "NSL", route: "subway" },
          geometry: {
            type: "LineString",
            coordinates: [
              [103.8, 1.3],
              [103.81, 1.31],
            ],
          },
        },
        {
          type: "Feature",
          properties: { id: "osm-2", ref: "BPLRT", route: "light_rail" },
          geometry: {
            type: "LineString",
            coordinates: [
              [103.7, 1.38],
              [103.71, 1.39],
            ],
          },
        },
      ],
    });
    assert.equal(lines.length, 2);
    assert.equal(lines[0]!.mode, "mrt");
    assert.equal(lines[1]!.mode, "lrt");

    const trains = seedTrains(lines);
    const a = tickTrains(trains, 1, 1_000);
    const b = tickTrains(trains, 1, 2_000);
    assert.equal(a.length, 2);
    assert.equal(a.every((v) => v.isInferred), true);
    assert.ok(
      a.some(
        (va) =>
          b.find((vb) => vb.id === va.id && (vb.lat !== va.lat || vb.lon !== va.lon)),
      ),
    );
  });
});
