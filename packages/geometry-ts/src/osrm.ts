import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type LonLat = [number, number];

export function osrmBaseUrl(): string {
  return (process.env.OSRM_URL?.trim() || "https://router.project-osrm.org").replace(
    /\/$/,
    "",
  );
}

export function osrmConcurrency(): number {
  const n = Number(process.env.OSRM_CONCURRENCY ?? 3);
  return Number.isFinite(n) && n >= 1 ? Math.min(8, Math.floor(n)) : 3;
}

/**
 * Drive between two stops via OSRM (GeoJSON overview).
 * Returns null on HTTP / routing failure so callers can keep a straight chord.
 */
export async function fetchOsrmSegment(
  from: LonLat,
  to: LonLat,
  baseUrl = osrmBaseUrl(),
  signal?: AbortSignal,
): Promise<LonLat[] | null> {
  const url =
    `${baseUrl}/route/v1/driving/` +
    `${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: signal ?? AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      code?: string;
      routes?: Array<{ geometry?: { coordinates?: LonLat[] } }>;
    };
    if (body.code && body.code !== "Ok") return null;
    const coords = body.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    return coords;
  } catch {
    return null;
  }
}

export function chordSegment(from: LonLat, to: LonLat): LonLat[] {
  return [from, to];
}

/** Simple promise pool (Node is single-threaded; index++ is safe). */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]!, i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export function edgeCacheFile(
  cacheDir: string,
  fromCode: string,
  toCode: string,
): string {
  // Stop codes are alphanumeric; keep filenames portable.
  const safe = `${fromCode}_${toCode}`.replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(cacheDir, `${safe}.json`);
}

export interface CachedEdge {
  fromCode: string;
  toCode: string;
  coordinates: LonLat[];
  source: "osrm" | "chord";
}

export class OsrmEdgeCache {
  constructor(
    private readonly cacheDir: string,
    private readonly baseUrl = osrmBaseUrl(),
  ) {}

  async ensureDir(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
  }

  async get(fromCode: string, toCode: string): Promise<CachedEdge | null> {
    try {
      const raw = await readFile(
        edgeCacheFile(this.cacheDir, fromCode, toCode),
        "utf8",
      );
      const parsed = JSON.parse(raw) as CachedEdge;
      if (!parsed?.coordinates || parsed.coordinates.length < 2) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async put(edge: CachedEdge): Promise<void> {
    await writeFile(
      edgeCacheFile(this.cacheDir, edge.fromCode, edge.toCode),
      `${JSON.stringify(edge)}\n`,
      "utf8",
    );
  }

  /**
   * Resolve a stop→stop polyline: disk cache → OSRM → straight chord.
   */
  async resolve(
    fromCode: string,
    toCode: string,
    from: LonLat,
    to: LonLat,
  ): Promise<CachedEdge & { cacheHit: boolean }> {
    const hit = await this.get(fromCode, toCode);
    if (hit) return { ...hit, cacheHit: true };

    const routed = await fetchOsrmSegment(from, to, this.baseUrl);
    const edge: CachedEdge = routed
      ? {
          fromCode,
          toCode,
          coordinates: routed,
          source: "osrm",
        }
      : {
          fromCode,
          toCode,
          coordinates: chordSegment(from, to),
          source: "chord",
        };
    await this.put(edge);
    return { ...edge, cacheHit: false };
  }
}
