import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FeatureCollection } from "geojson";
import { vehiclesFromArrivalFixtures } from "./fixture.js";
import {
  normalizeBusArrival,
  type LtaBusArrivalResponse,
} from "./normalize.js";
import {
  ARRIVAL_UPDATE_MS,
  classifyStops,
  planArrivalPoll,
} from "./schedule.js";
import { SkeletonBusSource } from "./skeleton.js";
import { snapVehiclesToRoutes } from "./snap.js";
import { collectVehicles } from "./source.js";

const fixture: LtaBusArrivalResponse = {
  BusStopCode: "01012",
  Services: [
    {
      ServiceNo: "10",
      NextBus: {
        Latitude: "1.29685",
        Longitude: "103.853",
        EstimatedArrival: "2026-08-30T12:00:00+08:00",
        Monitored: "1",
      },
      NextBus2: {
        Latitude: "0",
        Longitude: "0",
        EstimatedArrival: "2026-08-30T12:10:00+08:00",
        Monitored: "0",
      },
      NextBus3: {
        Latitude: "1.2975",
        Longitude: "103.8541",
        EstimatedArrival: "2026-08-30T12:20:00+08:00",
        Monitored: "0",
      },
    },
  ],
};

describe("normalizeBusArrival", () => {
  it("maps GPS-bearing next buses and skips zero coordinates", () => {
    const vehicles = normalizeBusArrival(fixture, 1_700_000_000_000);
    assert.equal(vehicles.length, 2);
    assert.equal(vehicles[0]?.id, "bus-10-01012-1");
    assert.equal(vehicles[0]?.mode, "bus");
    assert.equal(vehicles[0]?.isInferred, false);
    assert.equal(vehicles[1]?.id, "bus-10-01012-3");
    assert.equal(vehicles[1]?.isInferred, true);
  });
});

describe("SkeletonBusSource", () => {
  it("emits stable inferred bus ids", () => {
    const source = new SkeletonBusSource();
    const a = source.tick(1_000);
    const b = source.tick(2_000);
    assert.ok(a.length >= 3);
    assert.equal(a.every((v) => v.mode === "bus" && v.isInferred), true);
    assert.deepEqual(
      a.map((v) => v.id).sort(),
      b.map((v) => v.id).sort(),
    );
  });
});

describe("arrival fixtures", () => {
  it("loads data/lta/BusArrival when present", async () => {
    const vehicles = await vehiclesFromArrivalFixtures(1_700_000_000_000);
    if (vehicles.length === 0) return;
    assert.ok(vehicles.every((v) => v.mode === "bus"));
    assert.ok(
      vehicles.some((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon)),
    );
  });
});

describe("collectVehicles cascade", () => {
  it("uses fixture when forced", async () => {
    const result = await collectVehicles("fixture");
    if (result.mode === "fixture") {
      assert.ok(result.vehicles.length > 0);
    } else {
      assert.equal(result.mode, "skeleton");
    }
  });

  it("auto falls back past live LTA to fixture or skeleton", async () => {
    const prev = process.env.LTA_ACCOUNT_KEY;
    process.env.LTA_ACCOUNT_KEY = "test-key-not-live";
    try {
      const result = await collectVehicles("auto");
      assert.ok(result.mode === "fixture" || result.mode === "skeleton");
      assert.ok(result.reason?.includes("live LTA failed"));
    } finally {
      if (prev === undefined) delete process.env.LTA_ACCOUNT_KEY;
      else process.env.LTA_ACCOUNT_KEY = prev;
    }
  });
});

describe("snapVehiclesToRoutes", () => {
  it("pulls an off-route bus onto the nearest LineString", () => {
    const routes: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [103.75, 1.31],
              [103.76, 1.31],
              [103.77, 1.31],
            ],
          },
        },
      ],
    };
    const [snapped] = snapVehiclesToRoutes(
      [
        {
          id: "bus-1",
          mode: "bus",
          lat: 1.3105,
          lon: 103.76,
          observedAt: 1,
          isInferred: false,
        },
      ],
      routes,
      { maxKm: 1 },
    );
    assert.ok(snapped);
    assert.ok(Math.abs(snapped.lat - 1.31) < 1e-6);
    assert.ok(Math.abs(snapped.lon - 103.76) < 1e-6);
  });
});

describe("planArrivalPoll", () => {
  it("respects budget and prefers hot stops across cycles", () => {
    const stops = classifyStops(["A", "B", "C"], ["A"]);
    const first = planArrivalPoll(stops, 0, 2);
    assert.equal(first.plan.stops.length, 2);
    assert.ok(first.plan.stops.includes("A"));
    assert.equal(first.plan.nextDelayMs, ARRIVAL_UPDATE_MS);
  });
});
