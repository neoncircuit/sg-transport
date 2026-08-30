import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo `data/lta` unless overridden. */
export function defaultLtaDataDir(): string {
  return process.env.LTA_DATA_DIR?.trim() || path.resolve(here, "../../../data/lta");
}

/**
 * Resolve a dump file. Accepts either:
 * - `data/lta/BusStops.json`
 * - `data/lta/BusStops/BusStops.json` (folder layout from DataMall downloads)
 */
export async function resolveDumpPath(
  dataset: "BusStops" | "BusRoutes" | "BusServices",
  root = defaultLtaDataDir(),
): Promise<string | null> {
  const candidates = [
    path.join(root, dataset, `${dataset}.json`),
    path.join(root, `${dataset}.json`),
  ];
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

/** Read `{ value: T[] }` or a bare `T[]` from a local DataMall dump. */
export async function loadValueDump<T>(filePath: string): Promise<T[]> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "object" && raw !== null && Array.isArray((raw as { value?: unknown }).value)) {
    return (raw as { value: T[] }).value;
  }
  throw new Error(`expected { value: [] } or [] in ${filePath}`);
}
