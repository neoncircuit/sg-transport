/**
 * Bus geometry from LTA DataMall BusStops + BusRoutes.
 *
 * Resolution order (`BUS_GEOMETRY_SOURCE`, default `auto`):
 *   1. **live** — paginated DataMall when `LTA_ACCOUNT_KEY` is set
 *   2. **local** — `data/lta/` dumps (when they produce overlapping features)
 *   3. **fixture** — committed `fixtures/bus/` (always overlap — demo path)
 *
 * Successful live fetches are written back under `data/lta/` (gitignored)
 * so offline runs keep the island-wide cache.
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildServiceLines,
  buildStopPoints,
  type BusRouteRow,
  type BusStop,
} from "./bus-geojson.js";
import { defaultLtaDataDir, loadValueDump, resolveDumpPath } from "./lta-dump.js";

const BASE =
  process.env.LTA_DATAMALL_BASE ??
  "https://datamall2.mytransport.sg/ltaodataservice";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../data");
const fixtureDir = path.resolve(here, "../fixtures/bus");
const linesOut = path.join(outDir, "bus.geojson");
const stopsOut = path.join(outDir, "bus-stops.geojson");
const frontendGeom = path.resolve(
  here,
  "../../../apps/frontend-ts/public/geometry",
);

type SourcePreference = "auto" | "live" | "local" | "fixture";

function sourcePreference(): SourcePreference {
  const raw = (process.env.BUS_GEOMETRY_SOURCE ?? "auto").trim().toLowerCase();
  if (raw === "live" || raw === "local" || raw === "fixture" || raw === "auto") {
    return raw;
  }
  console.warn(
    `[geometry] unknown BUS_GEOMETRY_SOURCE=${raw}; using auto`,
  );
  return "auto";
}

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
    console.log(`[geometry] ${endpoint} … ${rows.length} rows`);
    if (body.value.length < 500) break;
    skip += 500;
  }
  return rows;
}

async function loadPair(
  label: string,
  stopsPath: string,
  routesPath: string,
): Promise<{ stops: BusStop[]; routes: BusRouteRow[]; label: string }> {
  console.log(`[geometry] ${label}:\n  ${stopsPath}\n  ${routesPath}`);
  const [stops, routes] = await Promise.all([
    loadValueDump<BusStop>(stopsPath),
    loadValueDump<BusRouteRow>(routesPath),
  ]);
  return { stops, routes, label };
}

async function loadLocal(): Promise<{
  stops: BusStop[];
  routes: BusRouteRow[];
  label: string;
} | null> {
  const stopsPath = await resolveDumpPath("BusStops");
  const routesPath = await resolveDumpPath("BusRoutes");
  if (!stopsPath || !routesPath) return null;
  return loadPair("local dumps", stopsPath, routesPath);
}

async function loadFixtures(): Promise<{
  stops: BusStop[];
  routes: BusRouteRow[];
  label: string;
}> {
  return loadPair(
    "committed fixtures",
    path.join(fixtureDir, "BusStops.json"),
    path.join(fixtureDir, "BusRoutes.json"),
  );
}

/** Persist live pages so offline extract / pollers can reuse island data. */
async function cacheLiveDumps(
  stops: BusStop[],
  routes: BusRouteRow[],
): Promise<void> {
  const root = defaultLtaDataDir();
  const stopsDir = path.join(root, "BusStops");
  const routesDir = path.join(root, "BusRoutes");
  await mkdir(stopsDir, { recursive: true });
  await mkdir(routesDir, { recursive: true });
  await writeFile(
    path.join(stopsDir, "BusStops.json"),
    `${JSON.stringify({ value: stops }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(routesDir, "BusRoutes.json"),
    `${JSON.stringify({ value: routes }, null, 2)}\n`,
    "utf8",
  );
  console.log(`[geometry] cached live dumps → ${root}/BusStops|BusRoutes`);
}

async function loadLive(accountKey: string): Promise<{
  stops: BusStop[];
  routes: BusRouteRow[];
  label: string;
}> {
  console.log("[geometry] downloading LTA BusStops + BusRoutes…");
  // Sequential pages per endpoint; fetch both endpoints in parallel.
  const [stops, routes] = await Promise.all([
    fetchAllPages<BusStop>("BusStops", accountKey),
    fetchAllPages<BusRouteRow>("BusRoutes", accountKey),
  ]);
  await cacheLiveDumps(stops, routes);
  return { stops, routes, label: "live DataMall" };
}

async function resolveInputs(): Promise<{
  stops: BusStop[];
  routes: BusRouteRow[];
  label: string;
}> {
  const pref = sourcePreference();
  const accountKey = process.env.LTA_ACCOUNT_KEY?.trim();

  async function tryLive(): Promise<{
    stops: BusStop[];
    routes: BusRouteRow[];
    label: string;
  } | null> {
    if (!accountKey) return null;
    try {
      return await loadLive(accountKey);
    } catch (err) {
      console.warn(
        `[geometry] live fetch failed (${err instanceof Error ? err.message : err})`,
      );
      return null;
    }
  }

  async function tryLocal(): Promise<{
    stops: BusStop[];
    routes: BusRouteRow[];
    label: string;
  } | null> {
    const local = await loadLocal();
    if (!local) return null;
    const lines = buildServiceLines(local.stops, local.routes);
    if (lines.features.length === 0) {
      console.warn(
        "[geometry] local dumps have 0 overlapping stop/route features",
      );
      return null;
    }
    return local;
  }

  if (pref === "live") {
    const live = await tryLive();
    if (live) return live;
    throw new Error("BUS_GEOMETRY_SOURCE=live requires a working LTA_ACCOUNT_KEY");
  }

  if (pref === "local") {
    const local = await tryLocal();
    if (local) return local;
    throw new Error("BUS_GEOMETRY_SOURCE=local found no usable data/lta dumps");
  }

  if (pref === "fixture") {
    return loadFixtures();
  }

  // auto: prefer live when keyed (island-wide), else local, else fixtures
  const live = await tryLive();
  if (live) return live;

  const local = await tryLocal();
  if (local) return local;

  try {
    return await loadFixtures();
  } catch (err) {
    console.error(
      [
        "[geometry] no usable BusStops/BusRoutes.",
        `  Put dumps under ${defaultLtaDataDir()}/ (see data/lta/README.md)`,
        "  or set LTA_ACCOUNT_KEY, or keep packages/geometry-ts/fixtures/bus/.",
        err instanceof Error ? `  ${err.message}` : "",
      ].join("\n"),
    );
    process.exitCode = 2;
    throw err;
  }
}

async function main(): Promise<void> {
  const { stops, routes, label } = await resolveInputs();
  const lines = buildServiceLines(stops, routes);
  const stopPoints = buildStopPoints(stops);

  await mkdir(outDir, { recursive: true });
  await writeFile(linesOut, `${JSON.stringify(lines)}\n`, "utf8");
  await writeFile(stopsOut, `${JSON.stringify(stopPoints)}\n`, "utf8");
  await mkdir(frontendGeom, { recursive: true });
  await copyFile(linesOut, path.join(frontendGeom, "bus.geojson"));
  await copyFile(stopsOut, path.join(frontendGeom, "bus-stops.geojson"));

  console.log(
    `[geometry] source=${label} · ${stops.length} stops, ${routes.length} route rows → ${lines.features.length} lines`,
  );
  console.log(`[geometry] wrote ${linesOut}`);
  console.log(`[geometry] wrote ${stopsOut}`);
  console.log(`[geometry] copied → ${frontendGeom}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
