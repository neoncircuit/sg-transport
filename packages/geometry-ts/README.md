# Geometry package — static route / rail extracts

```bash
# OSM MRT/LRT (no API key)
pnpm extract:rail

# LTA bus stop-to-stop polylines (needs DataMall key)
set LTA_ACCOUNT_KEY=…   # Windows: $env:LTA_ACCOUNT_KEY="…"
pnpm extract:bus
```

Outputs:

- `packages/geometry-ts/data/rail.geojson` (+ copy under `apps/frontend-ts/public/geometry/`)
- `packages/geometry-ts/data/bus.geojson` (when key is set)

See `SPOT_CHECKS.md` for manual alignment review.
