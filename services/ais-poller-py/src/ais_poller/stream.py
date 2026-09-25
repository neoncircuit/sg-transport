from __future__ import annotations

import asyncio
import json
import os
import threading
from collections.abc import Callable

from .fleet import VesselFleet
from .normalize import normalize_aisstream_envelope

STREAM_URL = "wss://stream.aisstream.io/v0/stream"


def bbox_from_env() -> list[list[list[float]]]:
    lat_min = float(os.environ.get("AIS_LAT_MIN", "1.05"))
    lat_max = float(os.environ.get("AIS_LAT_MAX", "1.48"))
    lon_min = float(os.environ.get("AIS_LON_MIN", "103.50"))
    lon_max = float(os.environ.get("AIS_LON_MAX", "104.15"))
    return [[[lat_min, lon_min], [lat_max, lon_max]]]


async def _stream_loop(
    api_key: str,
    fleet: VesselFleet,
    *,
    should_stop: Callable[[], bool],
) -> None:
    import websockets

    subscribe = {
        "APIKey": api_key,
        "BoundingBoxes": bbox_from_env(),
        "FilterMessageTypes": ["PositionReport"],
    }

    while not should_stop():
        try:
            async with websockets.connect(STREAM_URL, ping_interval=20) as ws:
                await ws.send(json.dumps(subscribe))
                print("[ais-poller] aisstream subscribed (Singapore Strait bbox)")
                async for raw in ws:
                    if should_stop():
                        break
                    try:
                        envelope = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(envelope, dict):
                        continue
                    vehicle = normalize_aisstream_envelope(envelope)
                    if vehicle is not None:
                        fleet.upsert(vehicle)
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001 — reconnect on any stream fault
            if should_stop():
                break
            print(f"[ais-poller] stream error ({err}); reconnecting in 3s")
            await asyncio.sleep(3)


def start_stream_thread(
    api_key: str,
    fleet: VesselFleet,
    *,
    should_stop: Callable[[], bool],
) -> threading.Thread:
    def runner() -> None:
        asyncio.run(_stream_loop(api_key, fleet, should_stop=should_stop))

    thread = threading.Thread(target=runner, name="aisstream", daemon=True)
    thread.start()
    return thread
