# AIS poller (Python)

Streams vessels near the Singapore Strait from
[aisstream.io](https://aisstream.io) (free API key), normalizes to the shared
`VehiclePosition` JSON shape, and `POST`s to `backend-ts` `/ingest` as source
`ais-poller`.

**Licensing:** free keys are fine for local development. Confirm aisstream
(and any commercial AIS aggregator) redistribution terms before a public
deploy — some providers restrict republishing vessel tracks.

## Run (local)

1. Create a free key at https://aisstream.io/apikeys  
2. Put `AIS_API_KEY=…` in the repo `.env` (or export it)  
3. With the gateway up:

```bash
cd services/ais-poller-py
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
python -m ais_poller
```

Without a key, `AIS_SOURCE=auto` falls back to the committed fixture (or set
`AIS_SOURCE=fixture`).

| Variable | Default | Meaning |
|---|---|---|
| `GATEWAY_URL` | (probe) | Gateway base URL |
| `AIS_API_KEY` | — | aisstream.io key (required for live) |
| `AIS_SOURCE` | `auto` | `auto` \| `live` \| `fixture` \| `empty` |
| `AIS_FIXTURE` | `fixtures/vessels.json` | Offline sample |
| `POLL_MS` | `5000` | How often to push the vessel snapshot |
| `AIS_STALE_MS` | `120000` | Drop vessels not updated within this window |
| `AIS_LAT_MIN` / `AIS_LAT_MAX` | `1.05` / `1.48` | Bbox |
| `AIS_LON_MIN` / `AIS_LON_MAX` | `103.50` / `104.15` | Bbox |

## Tests

```bash
pip install -e ".[dev]"
pytest
```
