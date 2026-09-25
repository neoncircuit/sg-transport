import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { railLineInfo } from "@sg-transport/shared-types";
import { fetchOverpass, railRoutesQuery } from "./overpass.js";
import { overpassRailToGeoJSON } from "./rail-geojson.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../data");
const outFile = path.join(outDir, "rail.geojson");
const frontendCopy = path.resolve(
  here,
  "../../../apps/frontend-ts/public/geometry/rail.geojson",
);

async function main(): Promise<void> {
  console.log(
    "[geometry] fetching OSM subway / light_rail / monorail / construction routes…",
  );
  const raw = await fetchOverpass(railRoutesQuery());
  const geojson = overpassRailToGeoJSON(raw);
  // Keep LTA MRT/LRT catalogue only — drop Changi Skytrain / Sentosa Express, etc.
  const before = geojson.features.length;
  geojson.features = geojson.features.filter((f) => {
    const ref = typeof f.properties?.ref === "string" ? f.properties.ref : "";
    return Boolean(railLineInfo(ref));
  });
  const dropped = before - geojson.features.length;
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, `${JSON.stringify(geojson)}\n`, "utf8");
  await mkdir(path.dirname(frontendCopy), { recursive: true });
  await copyFile(outFile, frontendCopy);
  console.log(
    `[geometry] wrote ${geojson.features.length} rail features → ${outFile}` +
      (dropped > 0 ? ` (filtered ${dropped} non-catalogue)` : ""),
  );
  console.log(`[geometry] copied for frontend → ${frontendCopy}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
