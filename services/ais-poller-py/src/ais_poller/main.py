from __future__ import annotations

import os
import signal
import sys
import time
import urllib.error

from .fetch import has_api_key, load_fixture, resolve_source_mode
from .fleet import VesselFleet
from .gateway import push_ingest, wait_for_gateway_url
from .stream import start_stream_thread

SOURCE_ID = "ais-poller"
_running = True


def _on_signal(signum: int, _frame: object) -> None:
    global _running
    print(f"[ais-poller] {signal.Signals(signum).name} received, shutting down")
    _running = False


def poll_ms() -> int:
    raw = os.environ.get("POLL_MS", "").strip()
    if raw:
        try:
            n = int(raw)
            if n > 0:
                return n
        except ValueError:
            pass
    return 5_000


def stale_ms() -> int:
    raw = os.environ.get("AIS_STALE_MS", "").strip()
    if raw:
        try:
            n = int(raw)
            if n > 0:
                return n
        except ValueError:
            pass
    return 120_000


def main() -> None:
    global _running
    signal.signal(signal.SIGINT, _on_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _on_signal)

    mode = resolve_source_mode()
    fleet = VesselFleet(stale_ms=stale_ms())
    label = mode

    if mode == "empty":
        label = "empty"
    elif mode == "fixture" or (mode == "auto" and not has_api_key()):
        try:
            vehicles = load_fixture()
            fleet.replace_all(vehicles)
            label = "fixture"
            print(f"[ais-poller] loaded {len(vehicles)} fixture vessels")
        except OSError as err:
            print(f"[ais-poller] fixture missing ({err}) — empty fleet")
            label = "empty"
    elif mode in ("live", "auto"):
        key = os.environ.get("AIS_API_KEY", "").strip()
        if not key:
            print("[ais-poller] AIS_API_KEY required for live; falling back to fixture")
            try:
                fleet.replace_all(load_fixture())
                label = "fixture"
            except OSError:
                label = "empty"
        else:
            label = "live"
            start_stream_thread(key, fleet, should_stop=lambda: not _running)
    else:
        print(f"[ais-poller] unknown AIS_SOURCE={mode!r}; using empty", file=sys.stderr)
        label = "empty"

    print("[ais-poller] waiting for gateway…")
    gateway_url = wait_for_gateway_url()
    print(f"[ais-poller] gateway {gateway_url}")
    print(f"[ais-poller] AIS_SOURCE={mode} effective={label} poll every {poll_ms()}ms")

    interval = poll_ms() / 1000.0
    while _running:
        try:
            vehicles = fleet.snapshot()
            payload = [v.to_json() for v in vehicles]
            push_ingest(gateway_url, payload, source=SOURCE_ID)
            print(
                f"[ais-poller] {label} → gateway {len(payload)} ships ({gateway_url})"
            )
        except (urllib.error.URLError, TimeoutError, OSError, RuntimeError) as err:
            print(f"[ais-poller] tick failed: {err}", file=sys.stderr)
        deadline = time.time() + interval
        while _running and time.time() < deadline:
            time.sleep(0.1)


if __name__ == "__main__":
    main()
