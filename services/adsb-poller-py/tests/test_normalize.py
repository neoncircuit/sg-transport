from __future__ import annotations

import json
from pathlib import Path

from adsb_poller.fetch import collect_vehicles, load_fixture
from adsb_poller.normalize import normalize_adsb_response, normalize_aircraft

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "aircraft.json"


def test_normalize_aircraft_basic():
    v = normalize_aircraft(
        {
            "hex": "ABC123",
            "lat": 1.3,
            "lon": 103.85,
            "track": 45.5,
            "flight": "SIA1   ",
        },
        now_ms=1_000,
    )
    assert v is not None
    assert v.id == "abc123"
    assert v.mode == "plane"
    assert v.lat == 1.3
    assert v.lon == 103.85
    assert v.bearing == 45.5
    assert v.lineRef == "SIA1"
    assert v.isInferred is False
    assert v.observedAt == 1_000


def test_normalize_drops_outside_sg_box():
    assert (
        normalize_aircraft(
            {"hex": "x", "lat": 2.0, "lon": 103.85, "track": 1},
            now_ms=1,
        )
        is None
    )


def test_normalize_response_dedupes_and_filters():
    raw = json.loads(FIXTURE.read_text(encoding="utf-8"))
    vehicles = normalize_adsb_response(raw, now_ms=42)
    ids = sorted(v.id for v in vehicles)
    assert ids == ["7504a1", "a1b2c3"]
    assert all(v.observedAt == 42 for v in vehicles)


def test_load_fixture():
    vehicles = load_fixture(FIXTURE)
    assert len(vehicles) == 2
    assert vehicles[0].to_json()["mode"] == "plane"


def test_collect_fixture_mode(monkeypatch):
    monkeypatch.setenv("ADSB_SOURCE", "fixture")
    monkeypatch.setenv("ADSB_FIXTURE", str(FIXTURE))
    mode, vehicles = collect_vehicles()
    assert mode == "fixture"
    assert len(vehicles) == 2


def test_collect_empty_mode(monkeypatch):
    monkeypatch.setenv("ADSB_SOURCE", "empty")
    mode, vehicles = collect_vehicles()
    assert mode == "empty"
    assert vehicles == []
