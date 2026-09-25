from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path


def find_repo_root(start: Path | None = None) -> Path:
    cur = (start or Path(__file__).resolve()).resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / "pnpm-workspace.yaml").is_file():
            return candidate
    # services/adsb-poller-py/src/adsb_poller → repo is parents[3]
    return Path(__file__).resolve().parents[3]


def preferred_gateway_port() -> int:
    raw = os.environ.get("PORT") or os.environ.get("GATEWAY_PORT")
    if raw is not None and raw.strip():
        try:
            n = int(raw)
            if n >= 0:
                return n
        except ValueError:
            pass
    return 8787


def read_gateway_port_file(repo_root: Path | None = None) -> int | None:
    root = repo_root or find_repo_root()
    override = os.environ.get("GATEWAY_PORT_FILE", "").strip()
    path = Path(override) if override else root / ".local" / "gateway.port"
    try:
        text = path.read_text(encoding="utf-8").strip()
        n = int(text)
        return n if n >= 0 else None
    except (OSError, ValueError):
        return None


def _health_ok(base_url: str, *, timeout_s: float = 0.5) -> bool:
    try:
        req = urllib.request.Request(f"{base_url}/health", method="GET")
        with urllib.request.urlopen(req, timeout=timeout_s) as res:
            return 200 <= res.status < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def wait_for_gateway_url(*, timeout_ms: int = 30_000) -> str:
    """Resolve gateway base URL (mirrors @sg-transport/ports waitForGatewayUrl)."""
    explicit = os.environ.get("GATEWAY_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")

    root = find_repo_root()
    preferred = preferred_gateway_port()
    deadline = time.time() + timeout_ms / 1000.0

    while time.time() < deadline:
        from_file = read_gateway_port_file(root)
        if from_file is not None:
            base = f"http://127.0.0.1:{from_file}"
            if _health_ok(base):
                return base
        for i in range(8):
            base = f"http://127.0.0.1:{preferred + i}"
            if _health_ok(base):
                return base
        time.sleep(0.25)

    raise TimeoutError(
        f"gateway not reachable within {timeout_ms}ms "
        "(set GATEWAY_URL or start backend-ts)"
    )


def push_ingest(
    gateway_url: str,
    vehicles: list[dict],
    *,
    source: str = "adsb-poller",
) -> None:
    body = json.dumps({"source": source, "vehicles": vehicles}).encode("utf-8")
    req = urllib.request.Request(
        f"{gateway_url.rstrip('/')}/ingest",
        data=body,
        headers={"content-type": "application/json", "connection": "close"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        if res.status not in (200, 204):
            text = res.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"ingest {res.status}: {text}")
