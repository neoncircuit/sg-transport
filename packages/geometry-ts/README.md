# @sg-transport/geometry

Static route geometry for the map.

```bash
pnpm extract:rail          # OSM MRT/LRT → data/rail.geojson (+ frontend public/)
pnpm extract:bus           # DataMall / local / fixtures → bus + bus-stops GeoJSON
```

## Bus extract sources (in order)

1. Local `data/lta/BusStops` + `BusRoutes` — if they **overlap** into ≥1 line
2. Live DataMall (when `LTA_ACCOUNT_KEY` is set)
3. Committed fixtures in `fixtures/bus/` (Victoria St DEMO service)

Outputs:

- `packages/geometry-ts/data/bus.geojson` (+ `apps/frontend-ts/public/geometry/`)
- `packages/geometry-ts/data/bus-stops.geojson` (+ public copy)

See `SPOT_CHECKS.md` for rail, `fixtures/bus/README.md` for the demo pair,
and `docs/datamall.md` for official API notes.
