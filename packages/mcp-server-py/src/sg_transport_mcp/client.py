"""Fetch live VehiclePosition[] from backend-ts GET /vehicles."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


def gateway_base_url() -> str:
    return os.environ.get("GATEWAY_URL", "http://127.0.0.1:8787").rstrip("/")


def fetch_vehicles(
    gateway_url: str | None = None,
    *,
    timeout_s: float = 10.0,
) -> list[dict[str, Any]]:
    """GET /vehicles and return the `vehicles` array."""
    base = (gateway_url or gateway_base_url()).rstrip("/")
    req = urllib.request.Request(
        f"{base}/vehicles",
        headers={"accept": "application/json", "connection": "close"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as res:
            raw = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"gateway HTTP {err.code}: {body}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"gateway unreachable at {base}: {err}") from err

    if not isinstance(raw, dict) or raw.get("type") != "snapshot":
        raise RuntimeError("gateway /vehicles did not return a snapshot message")
    vehicles = raw.get("vehicles")
    if not isinstance(vehicles, list):
        raise RuntimeError("gateway snapshot missing vehicles[]")
    return [v for v in vehicles if isinstance(v, dict)]
