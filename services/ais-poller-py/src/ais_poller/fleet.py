from __future__ import annotations

import threading
import time

from .types import VehiclePosition


class VesselFleet:
    """Thread-safe MMSI → latest VehiclePosition with TTL expiry."""

    def __init__(self, stale_ms: int = 120_000) -> None:
        self._stale_ms = stale_ms
        self._lock = threading.Lock()
        self._by_id: dict[str, VehiclePosition] = {}

    def upsert(self, vehicle: VehiclePosition) -> None:
        with self._lock:
            self._by_id[vehicle.id] = vehicle

    def replace_all(self, vehicles: list[VehiclePosition]) -> None:
        with self._lock:
            self._by_id = {v.id: v for v in vehicles}

    def snapshot(self, *, now_ms: int | None = None) -> list[VehiclePosition]:
        now = now_ms if now_ms is not None else int(time.time() * 1000)
        with self._lock:
            keep = {
                vid: v
                for vid, v in self._by_id.items()
                if now - v.observedAt <= self._stale_ms
            }
            self._by_id = keep
            return list(keep.values())

    def size(self) -> int:
        with self._lock:
            return len(self._by_id)
