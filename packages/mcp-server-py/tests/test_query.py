"""Unit tests for MCP query helpers (no live gateway required)."""

from __future__ import annotations

import pytest
from sg_transport_mcp.query import (
    haversine_m,
    snapshot_summary,
    vehicles_near,
    vehicles_on_route,
)


def _v(
    id: str,
    *,
    lat: float,
    lon: float,
    mode: str = "bus",
    line_ref: str | None = None,
) -> dict:
    row = {
        "id": id,
        "mode": mode,
        "lat": lat,
        "lon": lon,
        "observedAt": 1,
        "isInferred": False,
    }
    if line_ref is not None:
        row["lineRef"] = line_ref
    return row


def test_haversine_zero():
    assert haversine_m(1.3, 103.8, 1.3, 103.8) == 0.0


def test_vehicles_near_orders_by_distance():
    # ~111m per 0.001° lat near equator
    fleet = [
        _v("far", lat=1.305, lon=103.8),
        _v("near", lat=1.3005, lon=103.8),
        _v("plane", lat=1.3002, lon=103.8, mode="plane"),
    ]
    hits = vehicles_near(fleet, lat=1.3, lon=103.8, radius_m=200)
    assert [h["id"] for h in hits] == ["plane", "near"]
    assert hits[0]["distanceM"] < hits[1]["distanceM"]

    buses = vehicles_near(fleet, lat=1.3, lon=103.8, radius_m=200, mode="bus")
    assert [h["id"] for h in buses] == ["near"]


def test_vehicles_near_rejects_bad_radius():
    with pytest.raises(ValueError):
        vehicles_near([], lat=1.3, lon=103.8, radius_m=0)


def test_vehicles_on_route_case_insensitive():
    fleet = [
        _v("a", lat=1.3, lon=103.8, mode="mrt", line_ref="NSL"),
        _v("b", lat=1.31, lon=103.81, mode="mrt", line_ref="EWL"),
        _v("c", lat=1.32, lon=103.82, mode="bus", line_ref="190"),
    ]
    assert [v["id"] for v in vehicles_on_route(fleet, line_ref="nsl")] == ["a"]
    assert [v["id"] for v in vehicles_on_route(fleet, line_ref="190", mode="bus")] == [
        "c"
    ]


def test_snapshot_summary():
    fleet = [
        _v("1", lat=1.3, lon=103.8, mode="bus"),
        _v("2", lat=1.3, lon=103.8, mode="bus"),
        _v("3", lat=1.3, lon=103.8, mode="ship"),
    ]
    assert snapshot_summary(fleet) == {
        "total": 3,
        "byMode": {"bus": 2, "ship": 1},
    }
