from __future__ import annotations

import time
from collections.abc import Mapping, Sequence
from typing import Any

from .types import VehiclePosition

# Singapore Strait / port interest box (override via env in stream client).
SG_LAT_MIN, SG_LAT_MAX = 1.05, 1.48
SG_LON_MIN, SG_LON_MAX = 103.50, 104.15


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


def _as_mmsi(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, int) and value > 0:
        return str(value)
    if isinstance(value, str):
        digits = value.strip()
        if digits.isdigit() and int(digits) > 0:
            return digits
    return None


def in_sg_box(
    lat: float,
    lon: float,
    *,
    lat_min: float = SG_LAT_MIN,
    lat_max: float = SG_LAT_MAX,
    lon_min: float = SG_LON_MIN,
    lon_max: float = SG_LON_MAX,
) -> bool:
    return lat_min <= lat <= lat_max and lon_min <= lon <= lon_max


def normalize_position_report(
    report: Mapping[str, Any],
    *,
    meta: Mapping[str, Any] | None = None,
    now_ms: int | None = None,
) -> VehiclePosition | None:
    """Map an aisstream PositionReport (+ optional MetaData) to VehiclePosition."""
    mmsi = _as_mmsi(report.get("UserID")) or _as_mmsi(report.get("MMSI"))
    if meta:
        mmsi = mmsi or _as_mmsi(meta.get("MMSI")) or _as_mmsi(meta.get("mmsi"))
    if not mmsi:
        return None

    lat = _as_float(report.get("Latitude"))
    lon = _as_float(report.get("Longitude"))
    if lat is None or lon is None:
        return None
    if not in_sg_box(lat, lon):
        return None

    cog = _as_float(report.get("Cog"))
    if cog is None:
        cog = _as_float(report.get("TrueHeading"))
    if cog is not None and cog >= 360.0:
        # AIS uses 511 / 360+ as "not available"
        cog = None

    name: str | None = None
    if meta:
        ship_name = meta.get("ShipName") or meta.get("shipname")
        if isinstance(ship_name, str) and ship_name.strip():
            name = ship_name.strip()

    observed = now_ms if now_ms is not None else int(time.time() * 1000)
    return VehiclePosition(
        id=mmsi,
        mode="ship",
        lat=lat,
        lon=lon,
        observedAt=observed,
        isInferred=False,
        bearing=cog % 360.0 if cog is not None else None,
        lineRef=name,
    )


def normalize_aisstream_envelope(
    envelope: Mapping[str, Any],
    *,
    now_ms: int | None = None,
) -> VehiclePosition | None:
    """Parse one aisstream WebSocket JSON message."""
    message = envelope.get("Message")
    meta = envelope.get("MetaData")
    if not isinstance(message, Mapping):
        return None
    report = message.get("PositionReport")
    if not isinstance(report, Mapping):
        return None
    meta_map = meta if isinstance(meta, Mapping) else None
    return normalize_position_report(report, meta=meta_map, now_ms=now_ms)


def normalize_fixture_payload(
    payload: Mapping[str, Any] | Sequence[Any],
    *,
    now_ms: int | None = None,
) -> list[VehiclePosition]:
    """
    Accept either:
    - `{ "vessels": [ {mmsi,lat,lon,cog?,name?}, ... ] }`
    - a list of aisstream envelopes
    - a list of simplified vessel dicts
    """
    items: Sequence[Any]
    if isinstance(payload, Mapping):
        raw = payload.get("vessels") or payload.get("ac") or payload.get("messages")
        if not isinstance(raw, list):
            return []
        items = raw
    else:
        items = payload

    out: list[VehiclePosition] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, Mapping):
            continue
        vehicle: VehiclePosition | None = None
        if "Message" in item:
            vehicle = normalize_aisstream_envelope(item, now_ms=now_ms)
        elif "Latitude" in item or "UserID" in item:
            vehicle = normalize_position_report(item, now_ms=now_ms)
        else:
            # simplified fixture shape
            mmsi = _as_mmsi(item.get("mmsi") or item.get("id"))
            lat = _as_float(item.get("lat"))
            lon = _as_float(item.get("lon"))
            if mmsi and lat is not None and lon is not None and in_sg_box(lat, lon):
                cog = _as_float(item.get("cog") or item.get("bearing"))
                name = item.get("name")
                line = name.strip() if isinstance(name, str) and name.strip() else None
                observed = now_ms if now_ms is not None else int(time.time() * 1000)
                vehicle = VehiclePosition(
                    id=mmsi,
                    mode="ship",
                    lat=lat,
                    lon=lon,
                    observedAt=observed,
                    isInferred=False,
                    bearing=cog % 360.0 if cog is not None else None,
                    lineRef=line,
                )
        if vehicle is None or vehicle.id in seen:
            continue
        seen.add(vehicle.id)
        out.append(vehicle)
    return out
