# Development

## Prerequisites

- Node.js **20+** (CI uses 22)
- **pnpm** 10.14.0 (`packageManager` in root `package.json`)

## First run

```bash
pnpm install
cp .env.example .env   # optional until you have LTA_ACCOUNT_KEY
pnpm extract:rail      # if rail.geojson missing
pnpm extract:bus       # fixtures if local DataMall dumps don’t overlap
pnpm dev
```

| URL | What |
|---|---|
| http://localhost:5173 | Map (Vite; next free port if busy) |
| http://localhost:8787/health | Gateway health (next free port if busy) |
| `ws://…/ws` | Vehicle snapshots (via Vite proxy → bound gateway port) |
| `POST …/ingest` | Poller → gateway (internal) |

If 8787 (or 5173) is taken, the process binds the next free port. The gateway
writes `.local/gateway.port`; pollers and the Vite proxy discover it
automatically. Override with `PORT` / `GATEWAY_URL` if you need a fixed URL.

`pnpm dev` runs workspace `dev` scripts in parallel (frontend, gateway,
bus-poller, mrt-poller).

## Useful scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Local stack |
| `pnpm typecheck` | `tsc` across packages |
| `pnpm lint` | Lint (currently typecheck-backed where configured) |
| `pnpm test` | Unit / integration tests |
| `pnpm build` | Production builds |
| `pnpm extract:rail` | OSM MRT/LRT → GeoJSON |
| `pnpm extract:bus` | Bus lines + stops → GeoJSON |

Single package:

```bash
pnpm --filter @sg-transport/backend test
pnpm --filter @sg-transport/bus-poller dev
```

## Environment

See [`.env.example`](../.env.example). Highlights:

| Variable | Role |
|---|---|
| `LTA_ACCOUNT_KEY` | DataMall AccountKey (never commit) |
| `PORT` | Gateway preferred port (default 8787; falls forward if busy) |
| `GATEWAY_URL` | Poller → gateway base (omit to auto-discover) |
| `GATEWAY_PORT_FILE` | Override path for `.local/gateway.port` |
| `BUS_SOURCE` | `auto` \| `fixture` \| `skeleton` \| `lta` |
| `BUS_SNAP` | `0` disables route snap |
| `LTA_DATA_DIR` | Override local dump root (default `data/lta`) |
| `RAIL_GEOJSON` / `BUS_GEOJSON` | Override geometry paths for pollers |

## Verification before you call work “done”

From [`CLAUDE.md`](../CLAUDE.md):

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build   # when the change affects ship artifacts
```

## Docker (optional)

```bash
docker build -f infra/docker/Dockerfile.backend -t sg-transport-backend .
docker build -f infra/docker/Dockerfile.bus-poller -t sg-transport-bus-poller .
docker run --rm -p 8787:8787 sg-transport-backend
```

## Windows notes

Corporate TLS / antivirus can break `pnpm install`, Overpass, or
`git add` into `.git/objects`. Prefer retrying failed adds file-by-file;
never commit secrets to work around TLS.

## Next reading

- [Architecture](./architecture.md)
- [Contributing](./contributing.md)
- [Data & geometry](./data-and-geometry.md)
