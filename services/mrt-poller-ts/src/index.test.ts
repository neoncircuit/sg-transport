import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { pointAlongLine } from "./along-line.js";
import { fleetSize, headwaySecFor, isLineInService, lineSchedule } from "./schedule.js";
import { isRailServiceWindow, isRefInService } from "./service-hours.js";
import { railLinesFromGeoJSON, seedTrains, tickTrains } from "./simulate.js";

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

describe("schedule", () => {
  it("uses tighter peak headways", () => {
    const nsl = lineSchedule("NSL");
    assert.ok(headwaySecFor(nsl, 8 * 60) < headwaySecFor(nsl, 14 * 60));
  });

  it("wraps midnight for NSL last trains", () => {
    const nsl = lineSchedule("NSL");
    assert.equal(isLineInService(nsl, 5 * 60 + 30), true);
    assert.equal(isLineInService(nsl, 15), true);
    assert.equal(isLineInService(nsl, 3 * 60), false);
  });

  it("clears CCL after its earlier last train while NSL still runs", () => {
    const ccl = lineSchedule("CCL");
    const nsl = lineSchedule("NSL");
    const late = 23 * 60 + 45;
    assert.equal(isLineInService(ccl, late), false);
    assert.equal(isLineInService(nsl, late), true);
  });

  it("sizes fleet from run time / headway", () => {
    assert.equal(fleetSize(600, 120), 5);
    assert.equal(fleetSize(60, 300), 1);
  });
});

describe("service-hours", () => {
  afterEach(() => {
    delete process.env.MRT_FORCE_SERVICE;
  });

  it("honours MRT_FORCE_SERVICE override", () => {
    process.env.MRT_FORCE_SERVICE = "0";
    assert.equal(isRailServiceWindow(new Date("2026-09-22T10:00:00+08:00")), false);
    process.env.MRT_FORCE_SERVICE = "1";
    assert.equal(isRailServiceWindow(new Date("2026-09-22T03:00:00+08:00")), true);
  });

  it("follows NSL-like overnight gap by default", () => {
    delete process.env.MRT_FORCE_SERVICE;
    assert.equal(isRailServiceWindow(new Date("2026-09-22T03:00:00+08:00")), false);
    assert.equal(isRailServiceWindow(new Date("2026-09-22T00:15:00+08:00")), true);
    assert.equal(isRailServiceWindow(new Date("2026-09-22T00:45:00+08:00")), false);
    assert.equal(isRailServiceWindow(new Date("2026-09-22T05:30:00+08:00")), true);
  });

  it("can shut CCL while NSL is still open", () => {
    delete process.env.MRT_FORCE_SERVICE;
    const at = new Date("2026-09-22T23:45:00+08:00");
    assert.equal(isRefInService("NSL", at), true);
    assert.equal(isRefInService("CCL", at), false);
  });
});

describe("simulate", () => {
  it("builds inferred trains from rail GeoJSON with line colours", () => {
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

    const noon = new Date("2026-09-22T12:00:00+08:00");
    const trains = seedTrains(lines, noon);
    const a = tickTrains(trains, 1, 1_000);
    const b = tickTrains(trains, 1, 2_000);
    assert.ok(a.length >= 2);
    assert.equal(
      a.every((v) => v.isInferred),
      true,
    );
    assert.ok(a.some((v) => v.lineRef === "NSL" && v.color === "#DA291C"));
    assert.ok(a.some((v) => v.lineRef === "BPLRT" && v.operator === "SMRT"));
    assert.ok(
      a.some((va) =>
        b.find((vb) => vb.id === va.id && (vb.lat !== va.lat || vb.lon !== va.lon)),
      ),
    );
  });

  it("seeds a denser fleet in peak than off-peak", () => {
    const lines = railLinesFromGeoJSON({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: "osm-ewl", ref: "EWL", route: "subway" },
          geometry: {
            type: "LineString",
            // ~long corridor so fleet size can grow
            coordinates: [
              [103.6, 1.33],
              [103.7, 1.33],
              [103.8, 1.33],
              [103.9, 1.33],
              [104.0, 1.33],
            ],
          },
        },
      ],
    });
    const peak = seedTrains(lines, new Date("2026-09-22T08:00:00+08:00"));
    const off = seedTrains(lines, new Date("2026-09-22T14:00:00+08:00"));
    assert.ok(peak.length >= off.length);
  });

  it("does not simulate trains on under-construction lines", () => {
    const lines = railLinesFromGeoJSON({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: "jrl-1", ref: "JRL", route: "subway" },
          geometry: {
            type: "LineString",
            coordinates: [
              [103.7, 1.33],
              [103.75, 1.34],
            ],
          },
        },
      ],
    });
    assert.equal(lines[0]!.status, "construction");
    assert.equal(seedTrains(lines).length, 0);
  });
});
