# Railway — live backend (gateway + pollers)

Use this when the map UI stays on **GitHub Pages** and only the WebSocket
gateway + pollers run on Railway.

## 1. Create the project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**.
2. Select `neoncircuit/sg-transport` (or your fork).
3. For **each** service below: **Add Service** → same repo, **Root Directory** =
   `/`, then set **Config file path** to the `*.toml` listed.

| Railway service name | Config file | Public URL? |
|---|---|---|
| `backend` | `/infra/railway/backend.toml` | **Yes** — generate domain |
| `bus-poller` | `/infra/railway/bus-poller.toml` | No |
| `mrt-poller` | `/infra/railway/mrt-poller.toml` | No |
| `adsb-poller` | `/infra/railway/adsb-poller.toml` | No |

Name the gateway service **`backend`** so poller variables can reference
`${{backend.PORT}}`.

Skip `frontend` on Railway if you use GitHub Pages. Skip `ais-poller` until
AIS redistribution is cleared.

## 2. Shared variables (project or per service)

Generate a long random `INGEST_TOKEN` once (password manager or `openssl rand -hex 32`).

| Variable | Services | Value |
|---|---|---|
| `INGEST_TOKEN` | backend, bus-poller, mrt-poller, adsb-poller | same secret everywhere |
| `GATEWAY_URL` | bus, mrt, adsb pollers | `http://backend.railway.internal:${{backend.PORT}}` |
| `LTA_ACCOUNT_KEY` | bus-poller | your DataMall AccountKey |
| `BUS_SOURCE` | bus-poller | `auto` |
| `ADSB_SOURCE` | adsb-poller | `live` |

Railway sets `PORT` and `RAILWAY_ENVIRONMENT` on the gateway. Without
`INGEST_TOKEN`, the backend **exits on startup** (by design).

On every service: turn **off** sleep / serverless so WebSockets and pollers stay up.

## 3. Deploy order

1. Deploy **backend** → **Settings → Networking → Generate domain**.
2. Open `https://<your-backend-domain>/health` — expect `"ok": true` and
   `"phase": "2-live"`. `sources` may be empty until pollers run.
3. Deploy **mrt-poller**, **adsb-poller**, then **bus-poller** (after
   `LTA_ACCOUNT_KEY` is set).
4. Refresh `/health` — expect `sources` like `bus-poller`, `mrt-poller`,
   `adsb-poller` and non-zero `vehicleCount`.

## 4. Point GitHub Pages at the gateway

1. GitHub repo → **Settings → Secrets and variables → Actions → Variables**.
2. Add **`VITE_WS_URL`** = `wss://<your-backend-domain>/ws` (same host as
   `/health`, `wss` not `ws`).
3. **Actions → GitHub Pages demo → Run workflow** (or push a frontend change).

Hard-refresh the Pages site. The sidebar should **not** say “simulated fleet”.
Status should move to “Gateway connected” and counts should match `/health`.

## 5. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend crash loop | Missing `INGEST_TOKEN` on Railway |
| `/health` ok, no `bus-poller` | Poller missing token, wrong `GATEWAY_URL`, or bus service not deployed |
| Pages still “Demo · simulated fleet” | `VITE_WS_URL` unset or Pages workflow not re-run after setting it |
| WebSocket errors in browser devtools | Wrong `wss://` host, backend domain not generated, or backend down |
| Buses only at 4 stops | `LTA_ACCOUNT_KEY` missing — poller falls back to tiny default stop list |

Local rehearsal (no Railway): `docker compose up --build` then open
`http://127.0.0.1:8080` (see [`docs/deploy.md`](../../docs/deploy.md)).
