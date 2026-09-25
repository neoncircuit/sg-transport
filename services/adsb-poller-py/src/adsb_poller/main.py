from __future__ import annotations

import os
import signal
import sys
import time
import urllib.error

from .fetch import collect_vehicles
from .gateway import push_ingest, wait_for_gateway_url

SOURCE_ID = "adsb-poller"
_running = True


def _on_signal(signum: int, _frame: object) -> None:
    global _running
    print(f"[adsb-poller] {signal.Signals(signum).name} received, shutting down")
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


def main() -> None:
    global _running
    signal.signal(signal.SIGINT, _on_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _on_signal)

    print("[adsb-poller] waiting for gateway…")
    gateway_url = wait_for_gateway_url()
    print(f"[adsb-poller] gateway {gateway_url}")
    print(
        f"[adsb-poller] ADSB_SOURCE={os.environ.get('ADSB_SOURCE', 'auto')} "
        f"poll every {poll_ms()}ms"
    )

    interval = poll_ms() / 1000.0
    while _running:
        try:
            mode, vehicles = collect_vehicles()
            payload = [v.to_json() for v in vehicles]
            push_ingest(gateway_url, payload, source=SOURCE_ID)
            print(
                f"[adsb-poller] {mode} → gateway {len(payload)} planes ({gateway_url})"
            )
        except (urllib.error.URLError, TimeoutError, OSError, RuntimeError) as err:
            print(f"[adsb-poller] tick failed: {err}", file=sys.stderr)
        deadline = time.time() + interval
        while _running and time.time() < deadline:
            time.sleep(0.1)


if __name__ == "__main__":
    main()
