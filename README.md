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
apps/frontend-ts       MapLibre GL + Vite
apps/backend-ts        WebSocket gateway (fake vehicles for now)
packages/shared-types-ts   VehiclePosition contract
```

See [`DESIGN.md`](./DESIGN.md) for architecture and [`tasks/TODO.md`](./tasks/TODO.md)
for the phased build plan.

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
