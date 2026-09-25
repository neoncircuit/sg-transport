"""Haversine distance and vehicle query helpers (no I/O)."""

from __future__ import annotations

import math
from typing import Any

EARTH_RADIUS_M = 6_371_000.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two WGS84 points."""
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def vehicles_near(
    vehicles: list[dict[str, Any]],
    *,
    lat: float,
    lon: float,
    radius_m: float,
    mode: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return vehicles within `radius_m`, nearest first."""
    if radius_m <= 0:
        raise ValueError("radius_m must be positive")
    if limit <= 0:
        raise ValueError("limit must be positive")

    hits: list[tuple[float, dict[str, Any]]] = []
    for v in vehicles:
        if mode and v.get("mode") != mode:
            continue
        try:
            vlat = float(v["lat"])
            vlon = float(v["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        dist = haversine_m(lat, lon, vlat, vlon)
        if dist <= radius_m:
            hits.append((dist, {**v, "distanceM": round(dist, 1)}))

    hits.sort(key=lambda item: item[0])
    return [row for _, row in hits[:limit]]


def vehicles_on_route(
    vehicles: list[dict[str, Any]],
    *,
    line_ref: str,
    mode: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Return vehicles whose `lineRef` matches (case-insensitive)."""
    needle = line_ref.strip().upper()
    if not needle:
        raise ValueError("line_ref must be non-empty")
    if limit <= 0:
        raise ValueError("limit must be positive")

    out: list[dict[str, Any]] = []
    for v in vehicles:
        if mode and v.get("mode") != mode:
            continue
        ref = v.get("lineRef")
        if not isinstance(ref, str):
            continue
        if ref.strip().upper() != needle:
            continue
        out.append(v)
        if len(out) >= limit:
            break
    return out


def snapshot_summary(vehicles: list[dict[str, Any]]) -> dict[str, Any]:
    """Compact counts by mode for agent orientation."""
    by_mode: dict[str, int] = {}
    for v in vehicles:
        m = str(v.get("mode", "unknown"))
        by_mode[m] = by_mode.get(m, 0) + 1
    return {"total": len(vehicles), "byMode": by_mode}
