# SG Live — Real-Time Singapore Transport Map

A 2D live map of Singapore transport: buses, MRT/LRT, planes, and ships as
moving dots on real route geometry. Inspired by James Potter’s
[Zone One](https://london.jamespotter.dev/) and Hongwei PENG’s
[London Live](https://london.pengrubin.com).

> **Status:** Phase 6 local stack — buses, scheduled/simulated MRT, ADS-B
> planes, AIS ships (Air/Sea opt-in via legend). Public deploy is last
> (Phase 8); confirm AIS redistribution terms before going public.

## Quick start

```bash
pnpm install
pnpm extract:bus    # fixtures if local DataMall dumps don’t overlap
pnpm dev
# optional planes:  cd services/adsb-poller-py && pip install -e . && python -m adsb_poller
# optional ships:   cd services/ais-poller-py  && pip install -e . && AIS_API_KEY=… python -m ais_poller
```

- Frontend: http://localhost:5173  
- Gateway: http://localhost:8787/health · `ws://localhost:8787/ws`

Setup, env vars, and scripts: **[docs/development.md](./docs/development.md)**.

## Documentation

| Doc | Purpose |
|---|---|
| **[docs/](./docs/README.md)** | Documentation hub |
| [Architecture](./docs/architecture.md) | Runtime topology & contracts |
| [DESIGN.md](./DESIGN.md) | Product design & data strategy |
| [tasks/TODO.md](./tasks/TODO.md) | Phased build plan |
| [CREDITS.md](./CREDITS.md) | Attribution |

## Workspace layout

```
apps/frontend-ts           MapLibre GL + Vite
apps/backend-ts            WebSocket gateway + poller ingest
packages/shared-types-ts   VehiclePosition contract
packages/geometry-ts       OSM rail / LTA bus geometry extract
services/bus-poller-ts     Bus fleet → ingest (cascade + snap)
services/mrt-poller-ts     Simulated MRT/LRT along rail geometry
services/adsb-poller-py    ADS-B aircraft → ingest (adsb.lol)
services/ais-poller-py     AIS vessels → ingest (aisstream.io)
docs/                      Architecture, development, DataMall notes
infra/docker/              Dockerfiles for gateway + pollers
```

## Credits

See [`CREDITS.md`](./CREDITS.md).
