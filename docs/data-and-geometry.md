# Data & geometry

How static map geometry and local DataMall dumps fit together.

## Outputs the map loads

Served from `apps/frontend-ts/public/geometry/`:

| File | Source | Use |
|---|---|---|
| `rail.geojson` | `pnpm extract:rail` (OSM Overpass) | Rail lines + MRT simulator path |
| `bus.geojson` | `pnpm extract:bus` | Bus route polylines + GPS snap target |
| `bus-stops.geojson` | `pnpm extract:bus` | Stop dots |

Copies also land under `packages/geometry-ts/data/`.

## Bus extract resolution order

Controlled by `BUS_GEOMETRY_SOURCE` (`auto` default):

1. **live** — paginated DataMall when `LTA_ACCOUNT_KEY` is set (and on
   `auto` when the key works). Successful live pulls are cached under
   `data/lta/BusStops|BusRoutes` (gitignored).
2. **local** — `data/lta/` dumps when Stops and Routes overlap into ≥1 line
3. **fixture** — committed `fixtures/bus/` (Victoria St + WEST corridor demos)

Force a path with `BUS_GEOMETRY_SOURCE=live|local|fixture`.

Partial single-page API downloads often **don’t** overlap — the extractor
warns and falls through. See
[`packages/geometry-ts/README.md`](../packages/geometry-ts/README.md).

## Local DataMall dumps

Layout and naming: [`data/lta/README.md`](../data/lta/README.md).

```
data/lta/
  BusStops/BusStops.json
  BusRoutes/BusRoutes.json
  BusServices/BusServices.json
  BusArrival/BusArrival.json   # or <BusStopCode>.json
```

Raw `*.json` / `*.xml` here are **gitignored** (size + licence). They are the
poller’s offline / API-failure fallback, not just a pre-key convenience.

Official field specs and licence: [`datamall.md`](./datamall.md).

## Rail spot-checks

After regenerating rail geometry, skim
[`packages/geometry-ts/SPOT_CHECKS.md`](../packages/geometry-ts/SPOT_CHECKS.md)
(CCL loop, DTL curves, NSL, …).

## Priority reminder

**Buses → MRT/LRT → everything else.** Planes, ships, and traffic layers are
not prerequisites for a useful public-transport map
([`DESIGN.md` §8](../DESIGN.md)).
