import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { overpassRailToGeoJSON } from "./rail-geojson.js";
import type { OverpassResponse } from "./overpass.js";

describe("overpassRailToGeoJSON", () => {
  it("builds a LineString from a simple route relation", () => {
    const data: OverpassResponse = {
      elements: [
        { type: "node", id: 1, lat: 1.3, lon: 103.8 },
        { type: "node", id: 2, lat: 1.31, lon: 103.81 },
        { type: "node", id: 3, lat: 1.32, lon: 103.82 },
        { type: "way", id: 10, nodes: [1, 2] },
        { type: "way", id: 11, nodes: [2, 3] },
        {
          type: "relation",
          id: 100,
          members: [
            { type: "way", ref: 10, role: "" },
            { type: "way", ref: 11, role: "" },
          ],
          tags: { ref: "NSL", name: "North South Line", route: "subway" },
        },
      ],
    };

    const fc = overpassRailToGeoJSON(data);
    assert.equal(fc.features.length, 1);
    assert.equal(fc.features[0]!.properties?.ref, "NSL");
    assert.equal(fc.features[0]!.geometry.type, "LineString");
    assert.equal(fc.features[0]!.geometry.coordinates.length, 3);
  });
});
