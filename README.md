# SG Live — Real-Time Singapore Transport Map

A 2D live map of Singapore transport: buses, MRT/LRT, planes, and ships as
moving dots on real route geometry. Inspired by James Potter’s
[Zone One](https://london.jamespotter.dev/) and Hongwei PENG’s
[London Live](https://london.pengrubin.com).

> **Status:** Phase 0 local skeleton — MapLibre map of Singapore with
> simulated vehicles over WebSocket. No live LTA data yet.

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

## Docker (Phase 0b)

```bash
docker build -f infra/docker/Dockerfile.backend -t sg-transport-backend .
docker build -f infra/docker/Dockerfile.bus-poller -t sg-transport-bus-poller .
docker run --rm -p 8787:8787 sg-transport-backend
```

On push to `main`, CI builds and pushes both images to GHCR
(`ghcr.io/<owner>/sg-transport-backend` and `…-bus-poller`).

Public deploy of the map is still deferred until a host is chosen.

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
