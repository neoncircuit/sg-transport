# SG Live — Real-Time Singapore Transport Map

A 2D live map of Singapore transport: buses, MRT/LRT, planes, and ships as
moving dots on real route geometry. Inspired by James Potter’s
[Zone One](https://london.jamespotter.dev/) and Hongwei PENG’s
[London Live](https://london.pengrubin.com).

> **Status:** Phase 2–3 local stack — MapLibre map, bus ingest (fixture /
> skeleton), simulated MRT on OSM rail. Live DataMall waits on an AccountKey.
> Public deploy is last (Phase 8).

## Quick start

```bash
pnpm install
pnpm extract:bus    # fixtures if local DataMall dumps don’t overlap
pnpm dev
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
docs/                      Architecture, development, DataMall notes
infra/docker/              Dockerfiles for gateway + bus-poller
```

## Credits

See [`CREDITS.md`](./CREDITS.md).
