# SG Live — Real-Time Singapore Transport Map

A 2D live map of Singapore transport: buses, MRT/LRT, planes, and ships as
moving dots on real route geometry. Inspired by James Potter’s
[Zone One](https://london.jamespotter.dev/) and Hongwei PENG’s
[London Live](https://london.pengrubin.com).

> **Status:** Phase 2 skeleton — MapLibre map, OSM rail geometry, and a
> poller→gateway ingest path with a local bus fleet. Live LTA DataMall
> waits on an account key. Public deploy is last (Phase 8).

## Quick start

```bash
pnpm install
pnpm dev
```

- Frontend: http://localhost:5173  
- Gateway (health): http://localhost:8787/health  
- Ingest: `POST http://localhost:8787/ingest`  
- WebSocket: `ws://localhost:8787/ws`

`pnpm dev` runs the frontend, gateway, and bus-poller. Without
`LTA_ACCOUNT_KEY`, the poller pushes a skeleton bus fleet into the gateway
(fake MRT/plane/ship dots remain). Copy `.env.example` when you get a key.

## Workspace layout

```
apps/frontend-ts           MapLibre GL + Vite
apps/backend-ts            WebSocket gateway + poller ingest
packages/shared-types-ts   VehiclePosition contract
packages/geometry-ts       OSM rail / LTA bus geometry extract
services/bus-poller-ts     Skeleton fleet now; LTA when keyed
infra/docker/              Dockerfiles for gateway + poller
.github/workflows/ci.yml   Lint, typecheck, test, build, Docker
```

See [`DESIGN.md`](./DESIGN.md) for architecture, [`tasks/TODO.md`](./tasks/TODO.md)
for the phased build plan, and [`docs/datamall.md`](./docs/datamall.md) for
official LTA DataMall guide / licence links.

## Geometry (Phase 1)

```bash
pnpm extract:rail          # OSM MRT/LRT → public/geometry/rail.geojson
# After you have a DataMall AccountKey:
# $env:LTA_ACCOUNT_KEY="…"
pnpm extract:bus
```

See `packages/geometry-ts/README.md` and `SPOT_CHECKS.md`.


```bash
docker build -f infra/docker/Dockerfile.backend -t sg-transport-backend .
docker build -f infra/docker/Dockerfile.bus-poller -t sg-transport-bus-poller .
docker run --rm -p 8787:8787 sg-transport-backend
```

On push to `main`, CI builds and pushes both images to GHCR
(`ghcr.io/<owner>/sg-transport-backend` and `…-bus-poller`).

Public deploy is deliberately **last** (see Phase 8 in `tasks/TODO.md`) —
iterate locally until the product is worth sharing.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run frontend + backend in parallel |
| `pnpm typecheck` | TypeScript across the monorepo |
| `pnpm lint` | Lint (packages that define it) |
| `pnpm test` | Unit tests |
| `pnpm build` | Production builds |

## Credits

See [`CREDITS.md`](./CREDITS.md).
