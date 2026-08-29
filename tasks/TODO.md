# TODO — Phased Build Plan

Companion to `DESIGN.md`. Each phase is scoped to be independently shippable
and tagged, so CI/CD is exercised from day one instead of being bolted on at
the end. Nothing in a later phase should require reworking an earlier one —
if it does, that's a sign the phase boundary is in the wrong place.

Tag convention: `vMAJOR.MINOR.0` per phase completion, e.g. `v0.1.0` after
Phase 1. Stay on `0.x` until the MRT layer has at least the scheduled/
simulated fallback live (Phase 3 / `v0.3.0`) — that's the point this stops
being a demo.

---

## Phase 0 — Repo & CI/CD skeleton (no data yet)

**Goal**: prove the pipeline can build, test, and deploy an empty project
before a single vehicle is on the map.

### Phase 0a — Local demo (current slice)

- [x] Turborepo scaffold matching the structure in DESIGN.md §9
- [x] `shared-types-ts` package with `VehiclePosition` interface, published
      internally via workspace protocol
- [x] `apps/frontend-ts`: MapLibre GL + OpenFreeMap (Protomaps-based) basemap
      of Singapore; self-hosted PMTiles deferred to Phase 1
- [x] `apps/backend-ts`: bare WebSocket server that echoes hardcoded fake
      `VehiclePosition[]` on an interval
- [x] `CREDITS.md` + site footer crediting James Potter's Zone One and
      Hongwei PENG's London Live (`london.pengrubin.com`)

**Done when**: `pnpm dev` shows Singapore with fake dots moving locally.
**Tag**: `v0.0.1` (local)

### Phase 0b — CI / Docker / public URL (next)

- [x] GitHub Actions workflow: lint + typecheck + test + build on every PR/push
- [x] Docker images for `backend-ts` and `bus-poller-ts` stub; push to GHCR on
      merge to `main` (build-only on PRs)
- [ ] Deploy `frontend-ts` + `backend-ts` to a real public URL (deferred until
      hosting is chosen)

**Done when**: CI is green on PRs, Docker images build (and push on `main`);
public URL remains an open item.
**Tag**: `v0.0.2` (CI/Docker); public URL can land as `v0.0.3`

---

## Phase 1 — Static geometry pipeline

**Goal**: the non-live-but-hard part — get route/rail geometry into a shape
the frontend can render and vehicles can be snapped to.

- [ ] `packages/geometry-ts`: script to pull LTA static Bus Routes + Bus Stops
      datasets, join into per-service stop-sequence polylines
- [ ] Script to extract MRT/LRT `route=subway`/`route=light_rail` relations
      from an OSM Singapore `.pbf` (Overpass or Geofabrik), output GeoJSON
- [ ] Manual spot-check of at least 3 rail lines against real alignment
      (per DESIGN.md §7.4) — note any lines that need manual correction
- [ ] Geometry build runs as a CI job on a schedule (weekly is plenty —
      routes don't change often) and publishes versioned GeoJSON artifacts,
      not something computed at request time
- [ ] `web` renders static bus routes + rail lines as background layers

**Done when**: the map shows every bus route and MRT/LRT line as a static
line layer, sourced from a reproducible, CI-run build step.
**Tag**: `v0.1.0`

---

## Phase 2 — Bus layer (first real live data)

**Goal**: first end-to-end live layer, buses only.

- [ ] `services/bus-poller-ts`: poll LTA DataMall Bus Arrival API, normalize to
      `VehiclePosition`, push into gateway's state store
- [ ] Confirm actual API rate limit in practice (DESIGN.md §7.1) and design
      the polling schedule around it — priority tiering for high-traffic
      stops if needed
- [ ] Snap bus GPS onto its route polyline (Turf.js `nearestPointOnLine`)
      before broadcasting, so motion looks clean rather than jittery
- [ ] `backend-ts` fans out real bus positions over the existing WS channel
      from Phase 0
- [ ] Integration test: poller → gateway → a test WS client receives a
      well-formed `VehiclePosition[]` within N seconds of startup
- [ ] CI: this test runs on every PR touching `bus-poller-ts` or `backend-ts`
- [ ] Deploy behind a feature flag or just ship it — this is the first
      genuinely public-facing milestone

**Done when**: real, live Singapore buses are visibly moving on the public
map. This is the first version worth sharing.
**Tag**: `v0.2.0`

---

## Phase 3 — MRT/LRT, scheduled/simulated fallback

**Goal**: with buses live, cover the other half of Singapore's actual public
transport before touching anything non-essential. Ship the honest version of
the train layer (DESIGN.md §4, option 3) before attempting anything fragile.

- [ ] Derive per-line headways and first/last train times from LTA static
      data
- [ ] `services/mrt-poller-ts`: simulate train positions along the Phase 1
      rail geometry based on schedule + headway, not live data
- [ ] Mark these positions `isInferred: true` (or add a `isSimulated` flag
      if you want to distinguish "inferred from real data" vs "simulated
      from schedule" later) so the frontend can visually flag them as
      lower-confidence if desired
- [ ] CI/test pattern consistent with other pollers

**Done when**: trains move on the map on a plausible schedule, clearly
labeled as non-live if you choose to expose that distinction. At this point
both of Singapore's actual public transport modes are represented — this is
the milestone that makes the project feel "done" for its core purpose, even
before planes/ships exist.
**Tag**: `v0.3.0`

---

## Phase 4 — MRT/LRT, live inference (stretch goal)

**Goal**: only attempt this once Phase 3 is stable and deployed — this
phase is explicitly allowed to fail or stall without blocking a release.

- [ ] Validate the unofficial SMRT endpoint's actual reliability over at
      least a few days of polling before building anything on top of it
- [ ] If stable: build the countdown-to-position inference logic (same
      shape as the London tube approach), swap `mrt-poller-ts`'s data source,
      keep the Phase 3 simulator as an automatic fallback if the endpoint
      goes dark
- [ ] If unstable or blocked: stop here, keep Phase 3 as the permanent
      train layer, and note the outcome — this is a legitimate stopping
      point, not a failure of the project

**Tag**: `v0.4.0` if live inference ships and is stable for a week+;
otherwise `v0.3.x` stays the production tag and this phase is documented as
"attempted, not viable" rather than left silently incomplete. Either outcome
is a reasonable point to consider the core public-transport map complete.

---

## Phase 5 — Planes (ADS-B)

**Goal**: buses and trains are done; this is the first non-essential
addition, picked up once the core map is solid. Also proves the
architecture actually is layer-agnostic as designed.

- [ ] `services/adsb-poller-py`: pull from adsb.lol or ADSBExchange, filter to
      a bounding box around Singapore/Changi, normalize to `VehiclePosition`
      with `mode: "plane"`
- [ ] Client-side layer toggle (bus/train/plane/etc.) — first real test of
      the mode field pulling weight
- [ ] CI: same test/build pattern as `bus-poller-ts`, copy-pasted deliberately
      to confirm the poller pattern is actually reusable, not just similar

**Done when**: planes render alongside buses and trains, independently
toggleable.
**Tag**: `v0.5.0`

---

## Phase 6 — Ships (AIS)

**Goal**: the visually densest layer, and Singapore's real differentiator
over the London reference project — but still secondary to the public
transport layers.

- [ ] `services/ais-poller-py`: AISHub or MarineTraffic API (or a personal AIS
      receiver if you want to go that far) scoped to the Singapore Strait /
      port limits
- [ ] Confirm AIS provider licensing before public deploy — some AIS
      aggregators restrict redistribution more tightly than ADS-B sources do
- [ ] Normalize MMSI-based vessel IDs into `VehiclePosition`

**Done when**: all four live layers (bus, train, plane, ship) run
concurrently without one poller's failure affecting the others — this is
also the point to add basic per-poller health checks / alerting, since you
now have enough moving parts that silent failures are easy to miss.
**Tag**: `v1.0.0`

---

## Phase 7 — Polish / optional MCP query layer

- [ ] `packages/mcp-server-py`: expose the live state store as MCP tools
      (`vehicles_near`, `vehicles_on_route`) per the earlier MCP discussion
- [ ] Historical replay (if wanted) — this is the point a real database
      earns its place, not before
- [ ] Performance pass once all layers are live simultaneously: client-side
      culling, gateway broadcast batching, etc.
