# Public deploy (Phase 8)

Ship only after the map is something we’d stand behind — buses + simulated
MRT at minimum; planes/ships preferred. See [`tasks/TODO.md`](../tasks/TODO.md).

## Recommended host: Railway

**Default for SG Live’s first public URL.** Config stubs live under
[`infra/railway/`](../infra/railway/). Step-by-step for **Pages UI + Railway
backend** only: [`infra/railway/README.md`](../infra/railway/README.md).

### First try (manual)

1. Push this repo to GitHub (Railway deploys from git).
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**.
3. Create **four services** if the UI is GitHub Pages (recommended), or **five**
   if you also host the Vite frontend on Railway:

| Service | Config as Code path | Notes |
|---|---|---|
| `backend` | `/infra/railway/backend.toml` | Generate domain; public |
| `frontend` | `/infra/railway/frontend.toml` | Optional — skip when using Pages |
| `bus-poller` | `/infra/railway/bus-poller.toml` | Private only |
| `mrt-poller` | `/infra/railway/mrt-poller.toml` | Private only |
| `adsb-poller` | `/infra/railway/adsb-poller.toml` | Private only |

4. **Disable app sleeping / serverless** on every service (pollers + WS must
   stay up).
5. **backend** variables:
   - (Railway injects `PORT` and `RAILWAY_ENVIRONMENT` — host binds `0.0.0.0`)
   - `INGEST_TOKEN=<strong-random-secret>` (**required** on Railway)
6. **Pollers** variables:
   - `GATEWAY_URL=http://backend.railway.internal:${{backend.PORT}}`
   - `INGEST_TOKEN=<same-secret-as-backend>` on bus, MRT, and ADS-B
   - Bus: `LTA_ACCOUNT_KEY=<DataMall-key>` and `BUS_SOURCE=auto`
   - ADS-B: `ADSB_SOURCE=live`
   - Optional first smoke: `BUS_SOURCE=fixture` and `ADSB_SOURCE=fixture`
7. Deploy **backend** first; open its public URL → `/health` should be OK.
8. **frontend** build arg / variable used as Docker `ARG`:
   - `VITE_WS_URL=wss://<backend-public-host>/ws`
   - Redeploy frontend after backend domain is known
9. Open the frontend domain; legend should move. Check `/health` `sources`.

Do not deploy `ais-poller` publicly yet. AISStream works technically, but its
public redistribution terms are not explicit; obtain written permission before
publishing its vessel data.

Private networking uses Railway’s `*.railway.internal` DNS — keep **ingest**
traffic on it when possible (pollers stay private). `/ingest` is still exposed
by the public backend domain, so the shared bearer token is mandatory. The
backend public URL is needed for browser WebSockets.

### Use GitHub Pages for the frontend

The existing Pages workflow remains in demo mode until a live gateway is
configured:

1. Repository **Settings → Secrets and variables → Actions → Variables**.
2. Add `VITE_WS_URL` with `wss://<backend-public-host>/ws`.
3. Run **Actions → GitHub Pages demo → Run workflow**.

When `VITE_WS_URL` is present, the workflow builds live mode automatically.
Removing the variable returns subsequent builds to the self-contained demo.

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

1. **Licence** — Keep LTA and adsb.lol attribution visible; leave AIS disabled
   until written redistribution permission is obtained (`CREDITS.md`).
2. **Secrets** — `INGEST_TOKEN` and `LTA_ACCOUNT_KEY` via host variables,
   never in the image, logs, or frontend.
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
