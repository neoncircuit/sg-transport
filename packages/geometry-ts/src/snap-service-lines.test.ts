import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { chordSegment, mapPool, OsrmEdgeCache } from "./osrm.js";
import { buildRoadFollowingServiceLines } from "./snap-service-lines.js";

describe("mapPool", () => {
  it("preserves order with bounded concurrency", async () => {
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    assert.deepEqual(out, [2, 4, 6, 8, 10]);
  });
});

describe("OsrmEdgeCache", () => {
  it("caches chord fallback when fetch is forced to fail", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "osrm-edge-"));
    try {
      const cache = new OsrmEdgeCache(dir, "http://127.0.0.1:9"); // nothing listening
      const from: [number, number] = [103.8, 1.3];
      const to: [number, number] = [103.81, 1.31];
      const a = await cache.resolve("A", "B", from, to);
      assert.equal(a.source, "chord");
      assert.equal(a.cacheHit, false);
      assert.deepEqual(a.coordinates, chordSegment(from, to));

      const b = await cache.resolve("A", "B", from, to);
      assert.equal(b.cacheHit, true);
      assert.equal(b.source, "chord");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("buildRoadFollowingServiceLines", () => {
  it("stitches cached edges into a denser LineString", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "osrm-snap-"));
    try {
      const cache = new OsrmEdgeCache(dir, "http://127.0.0.1:9");
      // Seed an "osrm-like" polyline into the cache.
      await cache.put({
        fromCode: "A",
        toCode: "B",
        source: "osrm",
        coordinates: [
          [103.8, 1.3],
          [103.805, 1.302],
          [103.81, 1.31],
        ],
      });
      await cache.put({
        fromCode: "B",
        toCode: "C",
        source: "osrm",
        coordinates: [
          [103.81, 1.31],
          [103.815, 1.315],
          [103.82, 1.32],
        ],
      });

      const fc = await buildRoadFollowingServiceLines(
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
        cache,
      );

      assert.equal(fc.features.length, 1);
      assert.equal(fc.features[0]!.properties?.source, "lta+osrm");
      assert.equal(fc.features[0]!.geometry.coordinates.length, 5);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
