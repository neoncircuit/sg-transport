from __future__ import annotations

import json
import os
from pathlib import Path

from .normalize import normalize_fixture_payload
from .types import VehiclePosition


def fixture_path() -> Path:
    override = os.environ.get("AIS_FIXTURE", "").strip()
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[2] / "fixtures" / "vessels.json"


def load_fixture(path: Path | None = None) -> list[VehiclePosition]:
    file = path or fixture_path()
    raw = json.loads(file.read_text(encoding="utf-8"))
    return normalize_fixture_payload(raw)


def resolve_source_mode() -> str:
    return os.environ.get("AIS_SOURCE", "auto").strip().lower() or "auto"


def has_api_key() -> bool:
    return bool(os.environ.get("AIS_API_KEY", "").strip())
