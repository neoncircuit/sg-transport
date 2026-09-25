from __future__ import annotations

import json
from pathlib import Path

from ais_poller.fetch import load_fixture
from ais_poller.fleet import VesselFleet
from ais_poller.normalize import (
    normalize_aisstream_envelope,
    normalize_fixture_payload,
    normalize_position_report,
)
from ais_poller.types import VehiclePosition

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "vessels.json"


def test_normalize_position_report():
    v = normalize_position_report(
        {
            "UserID": 563012345,
            "Latitude": 1.25,
            "Longitude": 103.9,
            "Cog": 90.0,
        },
        meta={"ShipName": "TEST SHIP"},
        now_ms=1000,
    )
    assert v is not None
    assert v.id == "563012345"
    assert v.mode == "ship"
    assert v.bearing == 90.0
    assert v.lineRef == "TEST SHIP"
    assert v.isInferred is False


def test_normalize_drops_outside_box():
    assert (
        normalize_position_report(
            {"UserID": 1, "Latitude": 2.0, "Longitude": 103.9, "Cog": 1},
            now_ms=1,
        )
        is None
    )


def test_normalize_aisstream_envelope():
    envelope = {
        "MessageType": "PositionReport",
        "MetaData": {"MMSI": 563111111, "ShipName": "META"},
        "Message": {
            "PositionReport": {
                "UserID": 563111111,
                "Latitude": 1.3,
                "Longitude": 103.8,
                "Cog": 180,
            }
        },
    }
    v = normalize_aisstream_envelope(envelope, now_ms=42)
    assert v is not None
    assert v.id == "563111111"
    assert v.lineRef == "META"


def test_load_fixture_filters_outsiders():
    vehicles = load_fixture(FIXTURE)
    ids = sorted(v.id for v in vehicles)
    assert ids == ["563000001", "563000002"]


def test_normalize_fixture_payload_list():
    raw = json.loads(FIXTURE.read_text(encoding="utf-8"))
    vehicles = normalize_fixture_payload(raw, now_ms=7)
    assert len(vehicles) == 2
    assert all(v.observedAt == 7 for v in vehicles)


def test_fleet_expires_stale():
    fleet = VesselFleet(stale_ms=1_000)
    fleet.upsert(
        VehiclePosition(
            id="1",
            mode="ship",
            lat=1.2,
            lon=103.8,
            observedAt=0,
            isInferred=False,
        )
    )
    fleet.upsert(
        VehiclePosition(
            id="2",
            mode="ship",
            lat=1.21,
            lon=103.81,
            observedAt=5_000,
            isInferred=False,
        )
    )
    snap = fleet.snapshot(now_ms=5_500)
    assert [v.id for v in snap] == ["2"]
