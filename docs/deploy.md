# Public deploy (Phase 8)

Ship only after the map is something we’d stand behind — buses + simulated
MRT at minimum; planes/ships preferred. See [`tasks/TODO.md`](../tasks/TODO.md).

## Recommended host: Railway

**Default for SG Live’s first public URL.** Config stubs live under
[`infra/railway/`](../infra/railway/).

### First try (manual)

1. Push this repo to GitHub (Railway deploys from git).
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**.
3. Create **six services** from the same repo (Root Directory = `/` for each):

| Service | Config as Code path | Notes |
|---|---|---|
| `backend` | `/infra/railway/backend.toml` | Generate domain; public |
| `frontend` | `/infra/railway/frontend.toml` | Generate domain; public |
| `bus-poller` | `/infra/railway/bus-poller.toml` | Private only |
| `mrt-poller` | `/infra/railway/mrt-poller.toml` | Private only |
| `adsb-poller` | `/infra/railway/adsb-poller.toml` | Private only |
| `ais-poller` | `/infra/railway/ais-poller.toml` | Private only |

4. **Disable app sleeping / serverless** on every service (pollers + WS must
   stay up).
5. **backend** variables:
   - (Railway injects `PORT` and `RAILWAY_ENVIRONMENT` — host binds `0.0.0.0`)
6. **Pollers** variables (each):
   - `GATEWAY_URL=http://backend.railway.internal:${{backend.PORT}}`
   - `LTA_ACCOUNT_KEY` / `AIS_API_KEY` as needed (shared variables OK)
   - Optional: `BUS_SOURCE=fixture`, `ADSB_SOURCE=fixture`, `AIS_SOURCE=fixture`
     for a first smoke without live keys
7. Deploy **backend** first; open its public URL → `/health` should be OK.
8. **frontend** build arg / variable used as Docker `ARG`:
   - `VITE_WS_URL=wss://<backend-public-host>/ws`
   - Redeploy frontend after backend domain is known
9. Open the frontend domain; legend should move. Check `/health` `sources`.

Private networking uses Railway’s `*.railway.internal` DNS — keep **ingest**
off the public internet when possible (pollers stay private). The backend
public URL is still needed for browser WebSockets.

| Need | Railway fit |
|---|---|
| Always-on WebSocket gateway | Yes — keep **sleep off** |
| Multi-service Docker | One project, several services |
| Secrets | Project / service variables |
| Singapore latency | Nearby regions OK; Fly `sin` if you need pin later |

### Strong alternative: Fly.io

Prefer Fly if you care about pinning compute in **`sin` (Singapore)**. Same
Dockerfiles under `infra/docker/`.

### Avoid as the primary host

| Platform | Why not for the live core |
|---|---|
| **Vercel / v0** | Static frontend only |
| **Lovable** | Wrong product shape |
| **Render free tier** | Sleeps |

## Checklist before a public URL

1. **Licence** — Confirm LTA DataMall terms for redistribution; AIS free tier
   is local/dev only until commercial terms are reviewed (`CREDITS.md`).
2. **Secrets** — `LTA_ACCOUNT_KEY`, `AIS_API_KEY` via host secrets, never in
   the image or frontend.
3. **Gateway** — `GATEWAY_HOST=0.0.0.0` (Docker/Railway default); pollers use
   private `GATEWAY_URL`.
4. **Frontend** — `VITE_WS_URL` at image build time → public `wss://…/ws`.
5. **No sleep** — Disable idle sleep on gateway + pollers.
6. **Smoke** — `GET /health` shows expected `sources` / `byMode`; map shows
   vehicles; rollback = previous Railway deployment.

## Local multi-service rehearsal

```bash
docker compose up --build
curl -s http://127.0.0.1:8787/health | jq .
# Map UI: http://127.0.0.1:8080  (VITE_WS_URL defaults to ws://127.0.0.1:8787/ws)
```

## Health fields (ops)

`GET /health` returns `sources`, `sourceAgesMs`, `vehicleCount`, `byMode`,
and `revision` so missing pollers are visible without watching the map.
