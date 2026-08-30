# SG Live — Real-Time Singapore Transport Map

A 2D live map of Singapore transport: buses, MRT/LRT, planes, and ships as
moving dots on real route geometry. Inspired by James Potter’s
[Zone One](https://london.jamespotter.dev/) and Hongwei PENG’s
[London Live](https://london.pengrubin.com).

> **Status:** Phase 1 in progress — MapLibre map with simulated vehicles +
> OSM MRT/LRT line geometry. Bus geometry awaits an LTA DataMall key.
> Public deploy is last (Phase 8).

## Quick start

```bash
pnpm install
pnpm dev
```

- Frontend: http://localhost:5173  
- Gateway (health): http://localhost:8787/health  
- WebSocket: `ws://localhost:8787/ws`

## Workspace layout

```
apps/frontend-ts           MapLibre GL + Vite
apps/backend-ts            WebSocket gateway (fake vehicles for now)
packages/shared-types-ts   VehiclePosition contract
services/bus-poller-ts     Stub poller (real LTA wiring in Phase 2)
infra/docker/              Dockerfiles for gateway + poller stub
.github/workflows/ci.yml   Lint, typecheck, test, build, Docker
```

See [`DESIGN.md`](./DESIGN.md) for architecture and [`tasks/TODO.md`](./tasks/TODO.md)
for the phased build plan.

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
