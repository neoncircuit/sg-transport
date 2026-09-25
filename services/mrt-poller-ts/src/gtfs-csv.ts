/**
 * Map community GTFS route_id → our OSM/LTA-style refs (NSL, EWL, …).
 * Branches/loops collapse onto the parent line code used on the map.
 */
export const GTFS_ROUTE_TO_REF: Record<string, string> = {
  NS: "NSL",
  EW: "EWL",
  CG: "EWL",
  NE: "NEL",
  CC: "CCL",
  CCE: "CCL",
  DT: "DTL",
  TE: "TEL",
  JR: "JRL",
  JRL: "JRL",
  CR: "CRL",
  CRL: "CRL",
  BP: "BPLRT",
  BPL: "BPLRT",
  SKE: "SKLRT",
  SKW: "SKLRT",
  PGE: "PGLRT",
  PGW: "PGLRT",
};

/** GTFS `HH:MM:SS` (may exceed 24h) → minutes since midnight. */
export function gtfsTimeToMinutes(raw: string): number {
  const parts = raw.trim().split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  const s = Number(parts[2] ?? 0);
  if (![h, m, s].every(Number.isFinite)) return 0;
  return h * 60 + m + Math.floor(s / 60);
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]!] = cols[c] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

/** Minimal CSV split (handles quoted fields). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
