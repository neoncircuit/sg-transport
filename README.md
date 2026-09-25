# SG Live — Real-Time Singapore Transport Map

A 2D live map of Singapore transport: **buses**, **MRT/LRT**, **planes**, and
**ships** as moving dots on real route geometry. Inspired by James Potter’s
[Zone One](https://london.jamespotter.dev/) and Hongwei PENG’s
[London Live](https://london.pengrubin.com).

**[Open the public demo →](https://neoncircuit.github.io/sg-transport/)**
*(simulated fleet on GitHub Pages — not live DataMall/AIS)*

> If that link 404s: **Settings → Pages → Source = GitHub Actions**, then
> re-run the **GitHub Pages demo** workflow. Still on `main` only — no
> extra branches. Details: [`scripts/github-about.md`](./scripts/github-about.md).

> **Status:** Core layers run locally (Phases 0–6 + MCP/polish). Public
> **live** deploy (Railway) is Phase 8 — confirm DataMall / AIS terms before
> swapping the demo for a keyed gateway.

## About

SG Live is a mobile-first MapLibre client plus a small WebSocket gateway.
Pollers normalize every mode into one `VehiclePosition` contract, so buses,
trains, aircraft, and vessels share the same map pipeline. Trains may be
scheduled/simulated (`isInferred`) until a durable live feed exists.

| | |
|---|---|
| **Stack** | TypeScript monorepo (pnpm + Turborepo), Vite, MapLibre GL, Node `ws`, Python pollers |
| **Data** | LTA DataMall (buses), OSM rail geometry, community GTFS schedule overlay, adsb.lol, aisstream.io |
| **License notes** | See [`CREDITS.md`](./CREDITS.md) and [`docs/datamall.md`](./docs/datamall.md) before redistributing feeds |

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
- Demo without gateway: http://localhost:5173/?demo=1

Setup, env vars, and scripts: **[docs/development.md](./docs/development.md)**.
Deploy / Railway: **[docs/deploy.md](./docs/deploy.md)**.

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
packages/mcp-server-py     Optional MCP tools over GET /vehicles
services/bus-poller-ts     Bus fleet → ingest (cascade + snap)
services/mrt-poller-ts     Simulated MRT/LRT along rail geometry
services/adsb-poller-py    ADS-B aircraft → ingest (adsb.lol)
services/ais-poller-py     AIS vessels → ingest (aisstream.io)
docs/                      Architecture, development, DataMall notes
infra/docker/              Dockerfiles for gateway, pollers, frontend
infra/railway/             Railway service config stubs
```

## Credits

See [`CREDITS.md`](./CREDITS.md).
