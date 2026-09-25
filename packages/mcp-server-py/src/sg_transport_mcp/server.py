"""stdio MCP server exposing live SG transport queries."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from . import query
from .client import fetch_vehicles, gateway_base_url

mcp = FastMCP("sg-transport")


@mcp.tool()
def vehicle_snapshot() -> dict:
    """Summarise the live vehicle store by mode (counts only)."""
    vehicles = fetch_vehicles()
    return query.snapshot_summary(vehicles)


@mcp.tool()
def vehicles_near(
    lat: float,
    lon: float,
    radius_m: float = 500.0,
    mode: str | None = None,
    limit: int = 25,
) -> list[dict]:
    """
    List live vehicles within radius_m of a WGS84 point.

    Optional mode filter: bus | mrt | lrt | plane | ship.
    Each hit includes distanceM (metres from the query point).
    """
    fleet = fetch_vehicles()
    return query.vehicles_near(
        fleet,
        lat=lat,
        lon=lon,
        radius_m=radius_m,
        mode=mode,
        limit=limit,
    )


@mcp.tool()
def vehicles_on_route(
    line_ref: str,
    mode: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """
    List live vehicles whose lineRef matches a route or rail line code.

    Examples: NSL, EWL, 190, CRL. Matching is case-insensitive.
    """
    fleet = fetch_vehicles()
    return query.vehicles_on_route(
        fleet,
        line_ref=line_ref,
        mode=mode,
        limit=limit,
    )


def main() -> None:
    _ = gateway_base_url()
    mcp.run()


if __name__ == "__main__":
    main()
