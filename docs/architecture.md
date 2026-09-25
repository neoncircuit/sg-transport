# Architecture

Engineering view of **what runs today** and how pieces talk. Product intent
and “why buses before MRT” live in [`DESIGN.md`](../DESIGN.md).

## High-level

```
┌─────────────────┐     POST /ingest      ┌──────────────────┐
│  bus-poller-ts  │ ───────────────────▶  │                  │
│  (LTA / fixture │                       │   backend-ts     │
│   / skeleton)   │                       │   (gateway)      │
└─────────────────┘                       │                  │
┌─────────────────┐     POST /ingest      │  VehicleStore    │
│  mrt-poller-ts  │ ───────────────────▶  │  fake + overlays │
│  (simulated on  │                       │                  │
│   rail.geojson) │                       │  WS /ws          │──▶ MapLibre client
└─────────────────┘                       │  GET /health     │     (frontend-ts)
┌─────────────────┐     POST /ingest      │                  │
│  adsb-poller-py │ ───────────────────▶  │                  │
│  (adsb.lol)     │                       │                  │
└─────────────────┘                       │                  │
┌─────────────────┐     POST /ingest      │                  │
│  ais-poller-py  │ ───────────────────▶  │                  │
│  (aisstream.io) │                       └──────────────────┘
└─────────────────┘
```

**Rules of the road**

- Clients talk **only** to `backend-ts` (never to pollers or DataMall).
- Every live entity is a [`VehiclePosition`](./glossary.md#vehicleposition)
  from `@sg-transport/shared-types`.
- No LTA (or other) secrets in the frontend.
- Static geometry is files under `public/geometry/`, not the WebSocket.

## Packages & apps

| Path | Role |
|---|---|
| `apps/frontend-ts` | MapLibre GL map, themes, mobile-first chrome |
| `apps/backend-ts` | HTTP health + ingest, in-memory store, WebSocket fan-out |
| `packages/shared-types-ts` | Shared TypeScript contracts |
| `packages/geometry-ts` | Offline extracts → GeoJSON (rail OSM, bus LTA/fixtures) |
| `services/bus-poller-ts` | Bus positions → ingest (cascade + route snap) |
| `services/mrt-poller-ts` | Simulated MRT/LRT along rail geometry → ingest |
| `services/adsb-poller-py` | ADS-B aircraft (adsb.lol) → ingest as `plane` |
| `services/ais-poller-py` | AIS vessels (aisstream.io) → ingest as `ship` |
| `infra/docker` | Container images for gateway / bus / mrt / adsb / ais pollers |

## Bus poller cascade

Default `BUS_SOURCE=auto`:

1. **Live** DataMall Arrival — when `LTA_ACCOUNT_KEY` works  
2. **Fixture** — `data/lta/BusArrival/*.json` (offline / key / API failure)  
3. **Skeleton** — synthetic drifting fleet  

Buses are then optionally snapped onto `bus.geojson`
([Turf `nearestPointOnLine`](../services/bus-poller-ts/src/snap.ts)).

## Gateway merge

`VehicleStore` keeps a Phase 0 fake fleet only when **no** poller has
ingested recently. While any poller is fresh, the snapshot is **only** those
overlays — so a solo AIS feed does not leave fake MRT dots drifting over
water.

Known ingest `source` ids:

| Ingest `source` | Typical modes |
|---|---|
| `bus-poller` | `bus` |
| `mrt-poller` | `mrt`, `lrt` |
| `adsb-poller` | `plane` |
| `ais-poller` | `ship` |

See [`apps/backend-ts/src/vehicle-store.ts`](../apps/backend-ts/src/vehicle-store.ts).

## Geometry pipeline

```
OSM Overpass ──▶ extract:rail ──▶ rail.geojson ──▶ map + mrt-poller
LTA / fixtures ─▶ extract:bus ──▶ bus.geojson + bus-stops.geojson ──▶ map + snap
```

Details: [Data & geometry](./data-and-geometry.md).

## Frontend

- MapLibre layers: static rail/bus/stops, then vehicle circles (+ hit target).
- `isInferred: true` vehicles render dimmer (simulated / schedule-based).
- Legend mode toggles (bus/MRT/LRT on by default; Air/Sea off until opted in).
- Mobile-first controls (bottom sheet, locate, visibility-aware WS) —
  [`DESIGN.md` §11](../DESIGN.md).

## Local ports

Preferred gateway port is **8787**. If it is taken, `backend-ts` binds
8788, 8789, … and writes `.local/gateway.port`. Pollers call
`waitForGatewayUrl()`; the Vite dev proxy reads that file on each request
so `/ws` and `/health` follow the live port. Frontend Vite itself uses
`strictPort: false` (5173 → next free). `/health` also returns `version` /
`gitSha` from `git describe` (phase tags in `tasks/TODO.md`).

- Durable DB / historical archive (live-state only)
- Redis (in-memory store is enough until multi-instance deploy)
- Public deploy (Phase 8 — last on purpose)

## Related

- Build phases: [`tasks/TODO.md`](../tasks/TODO.md)
- DataMall APIs: [`datamall.md`](./datamall.md)
