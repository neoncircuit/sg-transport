/**
 * Phase 1 bus geometry extractor (LTA DataMall).
 *
 * Requires `LTA_ACCOUNT_KEY` from https://datamall.lta.gov.sg/
 * Endpoints: /BusStops and /BusRoutes (paginated, $skip).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildServiceLines,
  type BusRouteRow,
  type BusStop,
} from "./bus-geojson.js";

const BASE =
  process.env.LTA_DATAMALL_BASE ??
  "https://datamall2.mytransport.sg/ltaodataservice";

async function fetchAllPages<T>(
  endpoint: string,
  accountKey: string,
): Promise<T[]> {
  const rows: T[] = [];
  let skip = 0;
  for (;;) {
    const url = `${BASE}/${endpoint}?$skip=${skip}`;
    const res = await fetch(url, {
      headers: {
        AccountKey: accountKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`LTA ${endpoint} HTTP ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { value: T[] };
    if (!body.value?.length) break;
    rows.push(...body.value);
    if (body.value.length < 500) break;
    skip += 500;
  }
  return rows;
}

async function main(): Promise<void> {
  const accountKey = process.env.LTA_ACCOUNT_KEY;
  if (!accountKey) {
    console.error(
      [
        "[geometry] LTA_ACCOUNT_KEY is not set.",
        "  1. Request a key at https://datamall.lta.gov.sg/",
        "  2. export LTA_ACCOUNT_KEY=…  (or set in .env — never commit it)",
        "  3. pnpm --filter @sg-transport/geometry extract:bus",
        "Rail geometry does not need a key: pnpm --filter @sg-transport/geometry extract:rail",
      ].join("\n"),
    );
    process.exitCode = 2;
    return;
  }

  console.log("[geometry] downloading LTA BusStops + BusRoutes…");
  const [stops, routes] = await Promise.all([
    fetchAllPages<BusStop>("BusStops", accountKey),
    fetchAllPages<BusRouteRow>("BusRoutes", accountKey),
  ]);
  const geojson = buildServiceLines(stops, routes);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.resolve(here, "../data");
  const outFile = path.join(outDir, "bus.geojson");
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, `${JSON.stringify(geojson)}\n`, "utf8");
  console.log(
    `[geometry] wrote ${geojson.features.length} bus service lines → ${outFile}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
