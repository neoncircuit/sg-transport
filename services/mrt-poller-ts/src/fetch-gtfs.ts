/**
 * Download a community Singapore GTFS zip, extract rail schedules into a
 * small JSON overlay for the MRT simulator.
 *
 * Default feed: Vorld/singapore-gtfs (~340 KB, frequency-based rail).
 * Optional: set MRT_GTFS_URL to another zip (e.g. thecrapone/singapore-gtfs-2026
 * Git LFS media URL — ~314 MB; same synthetic MRT approach).
 *
 *   pnpm --filter @sg-transport/mrt-poller fetch:gtfs
 */

import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { railSchedulesFromGtfsDir } from "./gtfs-schedule.js";

const execFileAsync = promisify(execFile);

/** Small frequency-based community feed (prefer over 300MB+ vibecode zips). */
export const DEFAULT_GTFS_URL =
  "https://github.com/Vorld/singapore-gtfs/releases/download/v2026-07-12/singapore-gtfs.zip";

/** Documented alternate — Git LFS, large; synthetic MRT like the default. */
export const THECRAPONE_GTFS_URL =
  "https://media.githubusercontent.com/media/thecrapone/singapore-gtfs-2026/main/singapore-gtfs.zip";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const outJson = path.resolve(here, "../data/rail-gtfs-schedule.json");
const cacheDir = path.resolve(repoRoot, "data/gtfs");

async function downloadZip(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "user-agent": "sg-transport-mrt-poller/0.1" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`GTFS download HTTP ${res.status} for ${url}`);
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
    createWriteStream(dest),
  );
}

async function unzipTo(zipPath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  try {
    await execFileAsync("unzip", ["-o", "-q", zipPath, "-d", destDir]);
    return;
  } catch {
    // fall through
  }
  try {
    await execFileAsync("python3", [
      "-c",
      "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
      zipPath,
      destDir,
    ]);
    return;
  } catch {
    // fall through
  }
  // Windows host path for PowerShell when running under WSL
  const winZip = zipPath.startsWith("/mnt/")
    ? zipPath
        .replace(/^\/mnt\/([a-z])\//i, (_, d: string) => `${d.toUpperCase()}:\\`)
        .replace(/\//g, "\\")
    : zipPath;
  const winDest = destDir.startsWith("/mnt/")
    ? destDir
        .replace(/^\/mnt\/([a-z])\//i, (_, d: string) => `${d.toUpperCase()}:\\`)
        .replace(/\//g, "\\")
    : destDir;
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${winZip.replace(/'/g, "''")}' -DestinationPath '${winDest.replace(/'/g, "''")}' -Force`,
  ]);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const url = process.env.MRT_GTFS_URL?.trim() || DEFAULT_GTFS_URL;
  console.log(`[gtfs] fetching ${url}`);
  await mkdir(cacheDir, { recursive: true });
  const zipPath = path.join(cacheDir, "singapore-gtfs.zip");
  await downloadZip(url, zipPath);
  const size = (await readFile(zipPath)).byteLength;
  console.log(`[gtfs] downloaded ${(size / 1024).toFixed(1)} KiB → ${zipPath}`);

  const extractDir = await mkdtemp(path.join(tmpdir(), "sg-gtfs-"));
  try {
    await unzipTo(zipPath, extractDir);
    let gtfsDir = extractDir;
    const entries = await readdir(extractDir, { withFileTypes: true });
    if (
      entries.length === 1 &&
      entries[0]!.isDirectory() &&
      !(await fileExists(path.join(extractDir, "routes.txt")))
    ) {
      gtfsDir = path.join(extractDir, entries[0]!.name);
    }

    const schedule = await railSchedulesFromGtfsDir(gtfsDir, url);
    await mkdir(path.dirname(outJson), { recursive: true });
    await writeFile(outJson, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
    console.log(
      `[gtfs] wrote ${Object.keys(schedule.lines).length} rail lines → ${outJson}`,
    );
    for (const [ref, row] of Object.entries(schedule.lines)) {
      console.log(
        `[gtfs]   ${ref}: ${row.firstMin}–${row.lastMin} min · hw ${row.peakHeadwaySec}s · e2e ${row.endToEndMin}m`,
      );
    }
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
