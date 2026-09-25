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
| http://localhost:8787/vehicles | JSON vehicle snapshot (MCP / tools) |
| `ws://…/ws` | Vehicle snapshots (via Vite proxy → bound gateway port) |
| `POST …/ingest` | Poller → gateway (internal) |

If 8787 (or 5173) is taken, the process binds the next free port. The gateway
writes `.local/gateway.port`; pollers and the Vite proxy discover it
automatically. Override with `PORT` / `GATEWAY_URL` if you need a fixed URL.

`pnpm dev` runs a small bootstrap (`scripts/dev.mjs`) that:

1. Loads `.env` and remaps `NODE_EXTRA_CA_CERTS` for WSL if needed  
2. Heals native deps (`esbuild` / `rollup`) when `node_modules` was installed
   on another OS (common Windows ↔ WSL share on `/mnt/d`)  
3. Starts turbo (`persistent` tasks — no deprecated `--parallel`)

Skip the heal with `SKIP_NATIVE_ENSURE=1`. Force it with `pnpm ensure:native`.

## Versioning

Versions follow the phase tags in [`tasks/TODO.md`](../tasks/TODO.md)
(`v0.0.1`, `v0.0.2`, `v0.1.0`, `v0.2.0`, …). Between tags, the running app
uses **`git describe --tags --always --dirty`** (for example
`v0.1.0-8-gdee598f`).

| Surface | What you see |
|---|---|
| Map badge | Compact form (`v0.1.0` or `v0.1.0+8`); hover for full describe + SHA |
| `GET /health` | `version` + `gitSha` fields |
| CLI | `pnpm version:print` (or `--json`) |

Override with `APP_VERSION` / `GIT_SHA` in CI or Docker images that have no
`.git` directory. Tag a phase only when its “Done when” criteria are met.

## Useful scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Local stack |
| `pnpm typecheck` | `tsc` across packages |
| `pnpm lint` | Lint (currently typecheck-backed where configured) |
| `pnpm test` | Unit / integration tests |
| `pnpm build` | Production builds |
| `pnpm version:print` | Print `git describe` / `APP_VERSION` |
| `pnpm extract:rail` | OSM MRT/LRT → GeoJSON |
| `pnpm extract:bus` | Bus lines + stops → GeoJSON |

Single package:

```bash
pnpm --filter @sg-transport/backend test
pnpm --filter @sg-transport/bus-poller dev
```

### ADS-B planes (Python)

Runs outside turbo. With the gateway up:

```bash
cd services/adsb-poller-py
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
python -m adsb_poller
# or offline: ADSB_SOURCE=fixture python -m adsb_poller
```

Tap **Air** in the map legend to show planes (hidden by default).

### AIS ships (Python)

```bash
cd services/ais-poller-py
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
# free key from https://aisstream.io/apikeys — or omit for fixture-only
export AIS_API_KEY=…   # optional
python -m ais_poller
```

Tap **Sea** in the legend to show ships. Confirm aisstream redistribution
terms before any public deploy.

## Environment

See [`.env.example`](../.env.example). Highlights:

| Variable | Role |
|---|---|
| `LTA_ACCOUNT_KEY` | DataMall AccountKey (never commit) |
| `LTA_BUS_STOPS` | Comma-separated stop codes to poll (else `bus-stops.geojson`) |
| `LTA_HOT_STOPS` | Prefer these in the Arrival round-robin |
| `LTA_ARRIVAL_BUDGET` | Max Arrival API calls per poll cycle (default 40) |
| `LTA_ARRIVAL_CONCURRENCY` | Parallel Arrival fetches per cycle (default 8) |
| `NODE_EXTRA_CA_CERTS` | PEM path for corporate TLS roots (Windows MITM) |
| `APP_VERSION` | Override `git describe` (CI / Docker) |
| `GIT_SHA` | Override short SHA in `/health` and badge tooltip |
| `PORT` | Gateway preferred port (default 8787; falls forward if busy) |
| `GATEWAY_URL` | Poller → gateway base (omit to auto-discover) |
| `GATEWAY_PORT_FILE` | Override path for `.local/gateway.port` |
| `BUS_SOURCE` | `auto` \| `fixture` \| `skeleton` \| `lta` |
| `BUS_SNAP` | `0` disables route snap |
| `LTA_DATA_DIR` | Override local dump root (default `data/lta`) |
| `ADSB_SOURCE` | `auto` \| `live` \| `fixture` \| `empty` (adsb-poller-py) |
| `ADSB_FIXTURE` | Path to sample aircraft JSON |
| `AIS_API_KEY` | aisstream.io key (required for live ships) |
| `AIS_SOURCE` | `auto` \| `live` \| `fixture` \| `empty` |
| `AIS_FIXTURE` | Path to sample vessels JSON |
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
docker build -f infra/docker/Dockerfile.mrt-poller -t sg-transport-mrt-poller .
docker build -f infra/docker/Dockerfile.adsb-poller -t sg-transport-adsb-poller .
docker build -f infra/docker/Dockerfile.ais-poller -t sg-transport-ais-poller .
docker run --rm -p 8787:8787 sg-transport-backend
```

## Windows / WSL notes

Corporate TLS / antivirus can break `pnpm install`, Overpass, DataMall
(`UNABLE_TO_VERIFY_LEAF_SIGNATURE`), or `git add` into `.git/objects`. Prefer
retrying failed adds file-by-file; never commit secrets to work around TLS.

Node does **not** use the Windows certificate store. If DataMall works in
PowerShell/browsers but fails in Node:

```powershell
powershell -File scripts/export-corp-ca.ps1
# then in .env (repo-relative — works in Windows and WSL):
# NODE_EXTRA_CA_CERTS=.local/corp-ca.pem
```

Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` permanently.

**Windows ↔ WSL:** the repo on `/mnt/d/...` shares one `node_modules`. Native
packages (`esbuild`, `rollup`) are OS-specific. After switching OS, `pnpm dev`
should detect the skew and run `pnpm install --force` automatically. If it
still fails, from the environment you want to use:

```bash
rm -rf node_modules
pnpm install
pnpm dev
```

Prefer developing in **one** environment (Windows *or* WSL), not both against
the same tree, when you can.

## Next reading

- [Architecture](./architecture.md)
- [Contributing](./contributing.md)
- [Data & geometry](./data-and-geometry.md)
