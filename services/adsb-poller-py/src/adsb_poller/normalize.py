from __future__ import annotations

import time
from collections.abc import Mapping, Sequence
from typing import Any

from .types import VehiclePosition

# Rough Singapore / Changi interest box — drop far outliers from the circle query.
SG_LAT_MIN, SG_LAT_MAX = 1.15, 1.48
SG_LON_MIN, SG_LON_MAX = 103.6, 104.1


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def normalize_aircraft(
    ac: Mapping[str, Any],
    *,
    now_ms: int | None = None,
) -> VehiclePosition | None:
    """Map one adsb.lol aircraft object to VehiclePosition, or None if unusable."""
    hex_id = ac.get("hex")
    if not isinstance(hex_id, str) or not hex_id.strip():
        return None
    lat = _as_float(ac.get("lat"))
    lon = _as_float(ac.get("lon"))
    if lat is None or lon is None:
        return None
    if not (SG_LAT_MIN <= lat <= SG_LAT_MAX and SG_LON_MIN <= lon <= SG_LON_MAX):
        return None

    track = _as_float(ac.get("track"))
    if track is None:
        track = _as_float(ac.get("true_heading"))
    if track is None:
        track = _as_float(ac.get("mag_heading"))

    flight = ac.get("flight")
    line_ref: str | None = None
    if isinstance(flight, str) and flight.strip():
        line_ref = flight.strip()

    observed = now_ms if now_ms is not None else int(time.time() * 1000)
    return VehiclePosition(
        id=hex_id.strip().lower(),
        mode="plane",
        lat=lat,
        lon=lon,
        observedAt=observed,
        isInferred=False,
        bearing=track % 360.0 if track is not None else None,
        lineRef=line_ref,
    )


def normalize_adsb_response(
    payload: Mapping[str, Any] | Sequence[Any],
    *,
    now_ms: int | None = None,
) -> list[VehiclePosition]:
    """Normalize an adsb.lol `/v2/...` JSON body (or a bare aircraft list)."""
    if isinstance(payload, Sequence) and not isinstance(payload, (str, bytes)):
        aircraft = payload
    else:
        aircraft = payload.get("ac") if isinstance(payload, Mapping) else None
    if not isinstance(aircraft, list):
        return []

    out: list[VehiclePosition] = []
    seen: set[str] = set()
    for item in aircraft:
        if not isinstance(item, Mapping):
            continue
        vehicle = normalize_aircraft(item, now_ms=now_ms)
        if vehicle is None or vehicle.id in seen:
            continue
        seen.add(vehicle.id)
        out.append(vehicle)
    return out
