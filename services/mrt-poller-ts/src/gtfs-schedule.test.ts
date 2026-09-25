import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gtfsTimeToMinutes, parseCsv } from "./gtfs-csv.js";
import { railSchedulesFromGtfsDir } from "./gtfs-schedule.js";
import { lineSchedule, setGtfsScheduleOverlay } from "./schedule.js";

describe("gtfs-csv", () => {
  it("parses HH:MM:SS into minutes", () => {
    assert.equal(gtfsTimeToMinutes("05:30:00"), 5 * 60 + 30);
    assert.equal(gtfsTimeToMinutes("23:30:00"), 23 * 60 + 30);
  });

  it("parses simple CSV", () => {
    const rows = parseCsv("a,b\n1,2\n");
    assert.deepEqual(rows, [{ a: "1", b: "2" }]);
  });
});

describe("gtfs overlay", () => {
  it("overrides builtin when overlay is set", () => {
    setGtfsScheduleOverlay({
      source: "test",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      lines: {
        NSL: {
          firstMin: 330,
          lastMin: 1410,
          peakHeadwaySec: 258,
          offPeakHeadwaySec: 258,
          endToEndMin: 77,
        },
      },
    });
    const row = lineSchedule("NSL");
    assert.equal(row.source, "gtfs");
    assert.equal(row.lastMin, 1410);
    assert.equal(row.offPeakHeadwaySec, 258);
    assert.ok(row.peakHeadwaySec <= 258);
    setGtfsScheduleOverlay(null);
    assert.equal(lineSchedule("NSL").source, "builtin");
  });
});

describe("railSchedulesFromGtfsDir", () => {
  it("reads the cached Vorld extract when present", async () => {
    try {
      const schedule = await railSchedulesFromGtfsDir(
        new URL("../../../data/gtfs/vorld", import.meta.url).pathname.replace(
          /^\/([A-Za-z]:)/,
          "$1",
        ),
        "test-vorld",
      );
      assert.ok(schedule.lines.NSL);
      assert.ok(schedule.lines.EWL);
      assert.equal(schedule.lines.NSL!.firstMin, 5 * 60 + 30);
      assert.equal(schedule.lines.NSL!.lastMin, 23 * 60 + 30);
      assert.ok((schedule.lines.NSL!.endToEndMin ?? 0) > 30);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        // extract not present in CI — skip
        return;
      }
      throw err;
    }
  });
});
