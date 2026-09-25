# ADS-B poller (Python)

Pulls aircraft near Singapore from [adsb.lol](https://api.adsb.lol),
normalizes to the shared `VehiclePosition` JSON shape, and `POST`s to
`backend-ts` `/ingest` as source `adsb-poller`.

## Run (local)

With the gateway already up (`pnpm --filter @sg-transport/backend dev`):

```bash
cd services/adsb-poller-py
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -e ".[dev]"
python -m adsb_poller
```

Env:

| Variable | Default | Meaning |
|---|---|---|
| `GATEWAY_URL` | (probe) | Gateway base URL; else reads `.local/gateway.port` / probes 8787+ |
| `ADSB_SOURCE` | `auto` | `auto` \| `live` \| `fixture` \| `empty` |
| `ADSB_FIXTURE` | `fixtures/aircraft.json` | Offline sample when live fails / forced |
| `POLL_MS` | `5000` | Poll interval |
| `ADSB_LAT` / `ADSB_LON` / `ADSB_DIST_NM` | `1.35` / `103.9` / `50` | Search circle |

## Tests

```bash
pip install -e ".[dev]"
pytest
```
