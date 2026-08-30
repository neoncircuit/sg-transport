import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { vehiclesFromArrivalFixtures } from "./fixture.js";
import {
  normalizeBusArrival,
  type LtaBusArrivalResponse,
} from "./normalize.js";
import { SkeletonBusSource } from "./skeleton.js";
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
