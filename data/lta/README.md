# LTA DataMall bus dumps (local)

Drop JSON here **before** the live AccountKey client is wired.
Tools read these paths; prefer the folder layout DataMall downloads use.

## Layout (current)

```
data/lta/
  BusStops/BusStops.json
  BusRoutes/BusRoutes.json
  BusServices/BusServices.json
  BusArrival/BusArrival.json          # or <BusStopCode>.json
```

Flat alternatives also work: `data/lta/BusStops.json`, etc.

## Ad-hoc trio (Stops / Routes / Services)

Raw DataMall page shape:

```json
{ "odata.metadata": "…", "value": [ /* rows */ ] }
```

List APIs return **max 500 rows** per call. A single downloaded page is only
a sample — `pnpm extract:bus` needs **overlapping** Stops + Routes (same
network), ideally a full merge via `$skip=0,500,1000,…`.

XML copies are ignored; JSON only.

## Bus Arrival (real-time)

Per-stop payload (`BusStopCode` + `Services`). One sample file is enough for
fixture mode:

```bash
pnpm --filter @sg-transport/bus-poller dev
# BUS_SOURCE=auto → fixture when BusArrival/*.json exists
```

## Commands

```bash
pnpm extract:bus          # local dumps → packages/geometry-ts/data/bus.geojson
                          # + apps/frontend-ts/public/geometry/bus.geojson
```

Optional: `LTA_DATA_DIR`, `LTA_ACCOUNT_KEY` (live fetch if no local dumps).

**Fallback:** these dumps are the poller’s offline / API-failure rung
(`lta → fixture → skeleton`). Keep Arrival samples fresh when you can;
stale GPS is better than an empty map. See `docs/datamall.md`.

## Do not put here

- AccountKey / `.env`
- Derived GeoJSON (written under `packages/geometry-ts/data/`)

## Git

Raw `*.json` here are gitignored. See [`docs/datamall.md`](../docs/datamall.md).
