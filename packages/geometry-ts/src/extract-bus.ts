/**
 * Bus geometry from LTA DataMall BusStops + BusRoutes.
 *
 * Prefers local dumps under `data/lta/` (no AccountKey). Falls back to live
 * paginated fetch when `LTA_ACCOUNT_KEY` is set.
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildServiceLines,
  type BusRouteRow,
  type BusStop,
} from "./bus-geojson.js";
import { defaultLtaDataDir, loadValueDump, resolveDumpPath } from "./lta-dump.js";

const BASE =
  process.env.LTA_DATAMALL_BASE ??
  "https://datamall2.mytransport.sg/ltaodataservice";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../data");
const outFile = path.join(outDir, "bus.geojson");
const frontendCopy = path.resolve(
  here,
  "../../../apps/frontend-ts/public/geometry/bus.geojson",
);

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

async function loadLocal(): Promise<{ stops: BusStop[]; routes: BusRouteRow[] } | null> {
  const stopsPath = await resolveDumpPath("BusStops");
  const routesPath = await resolveDumpPath("BusRoutes");
  if (!stopsPath || !routesPath) return null;
  console.log(`[geometry] local dumps:\n  ${stopsPath}\n  ${routesPath}`);
  const [stops, routes] = await Promise.all([
    loadValueDump<BusStop>(stopsPath),
    loadValueDump<BusRouteRow>(routesPath),
  ]);
  return { stops, routes };
}

async function loadLive(accountKey: string): Promise<{
  stops: BusStop[];
  routes: BusRouteRow[];
}> {
  console.log("[geometry] downloading LTA BusStops + BusRoutes…");
  const [stops, routes] = await Promise.all([
    fetchAllPages<BusStop>("BusStops", accountKey),
    fetchAllPages<BusRouteRow>("BusRoutes", accountKey),
  ]);
  return { stops, routes };
}

async function main(): Promise<void> {
  const local = await loadLocal();
  const accountKey = process.env.LTA_ACCOUNT_KEY?.trim();

  let stops: BusStop[];
  let routes: BusRouteRow[];

  if (local) {
    ({ stops, routes } = local);
  } else if (accountKey) {
    ({ stops, routes } = await loadLive(accountKey));
  } else {
    console.error(
      [
        "[geometry] no local BusStops/BusRoutes dumps and no LTA_ACCOUNT_KEY.",
        `  Expected under ${defaultLtaDataDir()}/ (see data/lta/README.md)`,
        "  or set LTA_ACCOUNT_KEY and re-run.",
      ].join("\n"),
    );
    process.exitCode = 2;
    return;
  }

  const geojson = buildServiceLines(stops, routes);
  if (geojson.features.length === 0) {
    console.warn(
      [
        "[geometry] 0 bus line features — dumps likely don't overlap.",
        "  Partial DataMall samples often have Routes for service N and Stops",
        "  from a different page. Need matching full (or same-$skip) dumps.",
      ].join("\n"),
    );
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, `${JSON.stringify(geojson)}\n`, "utf8");
  await mkdir(path.dirname(frontendCopy), { recursive: true });
  await copyFile(outFile, frontendCopy);
  console.log(
    `[geometry] ${stops.length} stops, ${routes.length} route rows → ${geojson.features.length} lines`,
  );
  console.log(`[geometry] wrote ${outFile}`);
  console.log(`[geometry] copied ${frontendCopy}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
