from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .normalize import normalize_adsb_response
from .types import VehiclePosition

DEFAULT_LAT = 1.35
DEFAULT_LON = 103.9
DEFAULT_DIST_NM = 50.0
USER_AGENT = "sg-transport-adsb-poller/0.1"


def fixture_path() -> Path:
    override = os.environ.get("ADSB_FIXTURE", "").strip()
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[2] / "fixtures" / "aircraft.json"


def adsb_url(
    lat: float | None = None,
    lon: float | None = None,
    dist_nm: float | None = None,
) -> str:
    la = lat if lat is not None else float(os.environ.get("ADSB_LAT", DEFAULT_LAT))
    lo = lon if lon is not None else float(os.environ.get("ADSB_LON", DEFAULT_LON))
    dist = (
        dist_nm
        if dist_nm is not None
        else float(os.environ.get("ADSB_DIST_NM", DEFAULT_DIST_NM))
    )
    return f"https://api.adsb.lol/v2/lat/{la}/lon/{lo}/dist/{dist}"


def _http_get_json(url: str, *, timeout_s: float = 20.0) -> Any:
    req = urllib.request.Request(
        url,
        headers={"user-agent": USER_AGENT, "accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout_s) as res:
        body = res.read().decode("utf-8")
    return json.loads(body)


def load_fixture(path: Path | None = None) -> list[VehiclePosition]:
    file = path or fixture_path()
    raw = json.loads(file.read_text(encoding="utf-8"))
    return normalize_adsb_response(raw)


def fetch_live() -> list[VehiclePosition]:
    payload = _http_get_json(adsb_url())
    return normalize_adsb_response(payload)


def collect_vehicles(source: str | None = None) -> tuple[str, list[VehiclePosition]]:
    """
    Cascade: live → fixture → empty.
    Returns (mode_label, vehicles).
    """
    mode = (source or os.environ.get("ADSB_SOURCE", "auto")).strip().lower() or "auto"

    if mode == "empty":
        return "empty", []
    if mode == "fixture":
        return "fixture", load_fixture()
    if mode == "live":
        return "live", fetch_live()

    # auto
    try:
        vehicles = fetch_live()
        return "live", vehicles
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        json.JSONDecodeError,
        OSError,
    ) as err:
        print(f"[adsb-poller] live fetch failed ({err}); trying fixture")
        try:
            return "fixture", load_fixture()
        except OSError:
            print("[adsb-poller] fixture missing — publishing empty plane set")
            return "empty", []
