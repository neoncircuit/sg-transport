# @sg-transport/geometry

Static route geometry for the map.

```bash
pnpm extract:rail          # OSM MRT/LRT → data/rail.geojson (+ frontend public/)
pnpm extract:bus           # DataMall / local / fixtures → bus + bus-stops GeoJSON
# Optional road-following (avoids forest/restricted-area chords):
# BUS_ROUTE_SNAP=osrm pnpm extract:bus
```

## Bus extract sources (`BUS_GEOMETRY_SOURCE`, default `auto`)

1. Live DataMall (when `LTA_ACCOUNT_KEY` works) — caches into `data/lta/`
2. Local `data/lta/BusStops` + `BusRoutes` — if they **overlap** into ≥1 line
3. Committed fixtures in `fixtures/bus/` (Victoria St DEMO service)

Override with `BUS_GEOMETRY_SOURCE=live|local|fixture`.

### Road-following (`BUS_ROUTE_SNAP`)

Default `off` keeps straight stop-to-stop chords (fast, cuts corners).

Set `BUS_ROUTE_SNAP=osrm` to drive each consecutive stop pair via
[OSRM](https://project-osrm.org/) and stitch the results. Unique edges are
cached under `data/lta/osrm-edges/` (gitignored) so reruns are mostly offline.
Optional: `OSRM_URL`, `OSRM_CONCURRENCY` (default 3).

First island-wide run is ~8k unique edges and can take a while against the
public demo server; chord fallback is used per-edge on routing failure.

Outputs:

- `packages/geometry-ts/data/bus.geojson` (+ `apps/frontend-ts/public/geometry/`)
- `packages/geometry-ts/data/bus-stops.geojson` (+ public copy)

See `SPOT_CHECKS.md` for rail, `fixtures/bus/README.md` for the demo pair,
and `docs/datamall.md` for official API notes.
