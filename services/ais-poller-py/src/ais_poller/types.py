from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal

VehicleMode = Literal["bus", "mrt", "lrt", "plane", "ship"]


@dataclass(frozen=True)
class VehiclePosition:
    """Mirror of @sg-transport/shared-types VehiclePosition (JSON contract)."""

    id: str
    mode: VehicleMode
    lat: float
    lon: float
    observedAt: int
    isInferred: bool
    bearing: float | None = None
    lineRef: str | None = None
    color: str | None = None
    operator: str | None = None

    def to_json(self) -> dict[str, Any]:
        raw = asdict(self)
        return {k: v for k, v in raw.items() if v is not None}
