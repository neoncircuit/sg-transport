# Public deploy (Phase 8)

Ship only after the map is something we’d stand behind — buses + simulated
MRT at minimum; planes/ships preferred. See [`tasks/TODO.md`](../tasks/TODO.md).

## Checklist before a public URL

1. **Licence** — Confirm LTA DataMall terms for redistribution; AIS free tier
   is local/dev only until commercial terms are reviewed (`CREDITS.md`).
2. **Secrets** — `LTA_ACCOUNT_KEY`, `AIS_API_KEY` via host secrets, never in
   the image or frontend.
3. **Gateway** — Deploy `backend-ts` with a stable `PORT`; pollers set
   `GATEWAY_URL` to that internal URL.
4. **Frontend** — Build `apps/frontend-ts` with the production WS origin
   (same host via reverse proxy, or `VITE_*` if introduced).
5. **Smoke** — `GET /health` shows expected `sources` / `byMode`; map shows
   live buses + trains; rollback path documented.

## Local multi-service rehearsal

```bash
docker compose up --build
curl -s http://127.0.0.1:8787/health | jq .
# In another terminal:
pnpm --filter @sg-transport/frontend dev
```

Compose brings up gateway + pollers. The Vite app still runs on the host
until a frontend container lands.

## Hosting options (pick one)

| Host | Fit |
|---|---|
| Fly.io / Railway | Simple container deploys for gateway + pollers |
| Cloudflare Workers + container | Static frontend on Pages; API elsewhere |
| Single VPS + Caddy | Full control; reverse-proxy `/` → frontend, `/ws`+`/ingest`+`/health` → gateway |

## Health fields (ops)

`GET /health` returns `sources`, `sourceAgesMs`, `vehicleCount`, `byMode`,
and `revision` so missing pollers are visible without watching the map.
