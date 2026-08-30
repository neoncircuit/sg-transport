# SG Live — Real-Time Singapore Transport Map

## 1. Vision

A 2D live map of Singapore, same spirit as the London project: every bus,
train, plane, and ship rendered as a moving dot on real track/route geometry,
updating in near-real-time. MapLibre GL + TypeScript on the frontend, same as
the reference project. Difference from London: Singapore's data landscape is
smaller but in some ways *better* — buses report GPS directly, and the
Singapore Strait is one of the busiest shipping lanes on Earth, which makes
the AIS layer more visually interesting than the Thames.

The one layer that's genuinely harder than London: **MRT/LRT trains have no
official position feed at all** — not even an inferable one via arrivals API,
the way TfL exposes countdowns. This is the key open problem and is discussed
in §4.

## 2. Data source mapping (London → Singapore)

| Layer | London used | Singapore equivalent | Verdict |
|---|---|---|---|
| Buses | TfL bus GPS (noisy, route-snapped) | **LTA DataMall Bus Arrival API** — returns live lat/long + load per bus, per stop | Actually easier: GPS is given directly, no need to learn routes from traces (though snapping to a line is still needed for smooth animation) |
| Tube/rail | TfL countdown boards, inferred position | **No official train-position or countdown API.** An undocumented, unofficial SMRT arrival endpoint exists (used by RailRouter SG / similar hobby projects) that returns per-platform `next_train_arr` countdowns | Hardest layer — see §4 |
| National Rail | Darwin departure boards | N/A — Singapore has no long-distance rail network | Drop this layer |
| Planes | ADS-B | ADS-B (adsb.lol, ADSBExchange, or a local RTL-SDR receiver near Changi) | Same approach, works out of the box |
| Ships | AIS (Thames) | AIS (Singapore Strait / Port of Singapore — AISHub, MarineTraffic API, or a personal AIS receiver) | Same approach; SG Strait has far denser traffic than the Thames |
| Cable car | TfL cable car | Sentosa Cable Car / Mount Faber Line | No live feed exists; likely static/decorative only, or omit |
| Trams | TfL trams | N/A | Drop |

## 3. Track/route geometry

None of LTA's dynamic APIs return rail line geometry. Plan:

- **Bus routes**: LTA DataMall static Bus Routes + Bus Stops datasets give
  stop sequences per service; combine with OSM way geometry between stops
  for a driveable polyline.
- **MRT/LRT lines**: no official GeoJSON. Source from OSM Singapore extract
  (Overpass API or a Geofabrik `.pbf`), filtering `route=subway`/`route=light_rail`
  relations. This needs manual cleanup — OSM rail relations are decent for SG
  but not perfectly aligned to real track curvature everywhere.
- **Basemap**: same as London — Protomaps + OSM, self-hosted PMTiles.

## 4. The MRT problem (read this before committing to the project)

The London approach depends on TfL exposing a countdown per platform, which
lets you infer "this train is N seconds from this station" and animate it
along the track between the last two known points. Singapore does not
officially expose this. Options, roughly in order of how much I'd trust them:

1. **Use the unofficial SMRT arrival endpoint.** It reportedly returns the
   same shape of data TfL gives (per-platform next-train countdown). Risk:
   undocumented means no SLA, no rate-limit guarantees, and it can disappear
   or get blocked without notice — this is the single biggest risk to the
   whole project's train layer, not a minor implementation detail.
2. **Scrape/poll official station display data if any public-facing endpoint
   backs the concourse screens** (needs investigation, not confirmed to exist
   publicly).
3. **Ship the map without live train positions** and instead show trains as
   scheduled/simulated based on published headways and first/last train
   times (LTA static data has this) — honest, less impressive, but has zero
   dependency on an endpoint that could vanish.
4. **Contact LTA directly** — DataMall is an active developer program; worth
   a direct email asking whether train position/arrival data can be added to
   your API key's scope. Slow, but the only durable long-term fix.

Recommendation: build the whole pipeline layer-agnostic (see §6) so trains
can start as (3) — scheduled/simulated — and upgrade to (1) or (4) later
without a rewrite.

## 5. Tech stack

- **Frontend**: MapLibre GL JS + TypeScript, matching the reference project.
- **Ingestion**: small set of poller workers (Node/TypeScript or Python,
  whichever you're faster in — Python gives you AIS/ADS-B decoding libraries
  more readily).
- **State/transport**: Redis (or just an in-memory store to start) holding
  latest known position per vehicle, pushed to clients over WebSocket/SSE.
  No need for a database in v1 — this is a live-state system, not an
  archive, unless you want historical replay later.
- **Map matching**: Turf.js `nearestPointOnLine` is enough for snapping bus
  GPS onto route polylines; a real map-matching engine (Valhalla/OSRM) is
  overkill for v1 given LTA already gives you GPS, not just noisy pings.

## 6. Architecture sketch

```
[LTA DataMall: bus arrival]  ─┐
[Unofficial SMRT endpoint]   ─┼─▶ [poller workers] ─▶ [normalizer] ─▶ [state store] ─▶ [WS/SSE broadcaster] ─▶ [MapLibre client]
[ADS-B feed]                 ─┤                                         ▲
[AIS feed]                   ─┘                              [static geometry: OSM rail + bus routes]
```

Example of the normalized shape every poller should converge on before
hitting the state store — this is the contract that keeps trains/buses/
planes/ships interchangeable on the client side:

```typescript
/** A single vehicle's last-known state, normalized across all data sources. */
interface VehiclePosition {
  /** Stable ID for this vehicle across updates (bus reg no., ICAO24, MMSI, or a synthetic train-service id). */
  id: string;
  /** Which layer this belongs to, used for styling and layer toggles. */
  mode: "bus" | "mrt" | "lrt" | "plane" | "ship";
  /** WGS84 coordinates. */
  lat: number;
  lon: number;
  /** Heading in degrees, if known — used to orient the icon. */
  bearing?: number;
  /** Epoch ms this position was last confirmed, not when it was last rendered. */
  observedAt: number;
  /** True if lat/lon is interpolated (e.g. MRT position inferred from countdown) rather than a direct GPS fix. */
  isInferred: boolean;
}
```

## 7. Risks / open questions to resolve before writing code

1. **LTA DataMall rate limits** for the Bus Arrival API — it's per bus-stop-
   code, and Singapore has ~5,000 stops. Confirm actual quota per API key
   before assuming you can poll every stop every few seconds; you may need
   to prioritize high-traffic stops or accept a slower refresh cycle for
   quiet ones.
2. **Terms of use** — check DataMall's licence terms for public/commercial
   redistribution of live data on a public website before launching.
3. **Confirm the unofficial SMRT endpoint actually still works** and decide
   up front how gracefully the train layer degrades if it stops responding
   mid-project — this determines whether you build option 3 (scheduled/
   simulated) as the real fallback or as an afterthought.
4. **OSM rail geometry quality check** — spot-check a few lines (e.g. Circle
   Line's loop, Downtown Line's curves) against the real alignment before
   committing to it as the animation path.
5. Cable car / trishaw / river taxi layers: probably not worth the effort
   given no live feed exists — treat as a "maybe later, purely decorative"
   idea rather than part of the MVP.

## 8. Suggested build order

Buses and MRT/LRT are Singapore's actual public transport, so they come
first — planes and ships are additions once that core is solid, not
prerequisites for it.

1. Bus layer, using LTA DataMall GPS directly (best data quality, fastest
   to a working demo).
2. MRT/LRT, starting with scheduled/simulated positions (§4, option 3) —
   this is what makes the map cover Singapore's public transport
   completely, even before anything fancier is attempted.
3. Only once both are stable: attempt live MRT/LRT inference via the
   unofficial endpoint (§4, option 1), as an explicit stretch goal that's
   allowed to not pan out.
4. Planes (ADS-B) — low-risk, mainly proves the architecture is genuinely
   layer-agnostic.
5. Ships (AIS) — the most visually striking layer, but the least essential.

See `TODO.md` for this build order broken into versioned, shippable phases
with their own CI/CD checkpoints.

## 10. Attribution

This project is directly inspired by two existing works, and that should be
visible in the repo (a `CREDITS.md` or a footer/about section on the site
itself) rather than just in this design doc:

- **James Potter's "Zone One"** — the original 3D live map concept for
  London transport, covering Zone 1.
- **London Live (`london.pengrubin.com`)** — the 2D adaptation that this
  project's approach is modeled on directly: the inference technique for
  trains without GPS (arrival countdowns animated along track geometry),
  the GPS-snapping approach for buses, and the overall MapLibre GL +
  TypeScript stack all come from studying that build.

Suggested wording for a site credit, adjust as needed: *"Inspired by James
Potter's 'Zone One' and [creator]'s London Live map — adapted here for
Singapore's public transport."* Worth confirming the actual name/handle
behind the London Live site before publishing a credit line, rather than
guessing from the domain — a quick check of the site's own about/footer or
the LinkedIn post it was shared from should settle it.

## 11. Mobile-first UX

Realistically, the primary use case is someone checking their bus/train on
their phone while actually out and about — not sitting at a desk. Desktop
should still work, but the default design target is mobile, not a
responsive afterthought bolted onto a desktop layout.

Implications worth deciding early rather than retrofitting later:

- **Layer/UI controls**: a bottom sheet or collapsible drawer for
  layer toggles (bus/train/plane/ship) rather than a desktop sidebar —
  sidebars eat too much of a phone viewport.
- **Touch targets**: vehicle markers need a large enough hit area to tap
  reliably on a small screen, independent of how small they render visually
  at a given zoom level.
- **Performance/battery**: continuous WebSocket updates + animated markers
  are more battery-costly on mobile than desktop. Worth throttling animation
  frame rate or update frequency when the tab/app isn't in the foreground,
  and being conservative about how many layers are on by default (bus only,
  rather than everything at once) until the user opts in to more.
- **Geolocation**: "center on me" / "show what's near me" is a much more
  natural mobile interaction than panning a full-city map manually — worth
  treating as core rather than a nice-to-have, given the realistic use case
  above.
- **Network conditions**: mobile users are more likely to be on patchy
  cellular (underground platforms, buses moving between cell towers) —
  the WS/SSE reconnect logic in `backend-ts` needs to handle frequent
  disconnects gracefully rather than assuming a stable connection.
- **PWA**: worth considering "add to home screen" support once the core map
  is stable — low effort relative to the payoff for a mobile-primary tool.

This doesn't change the phased build order in `TODO.md` — it's a constraint
on *how* `frontend-ts` and `backend-ts` are built in Phases 0–2, not a new
phase of its own.

## 9. Project structure

A Turborepo monorepo (same pattern as the AIAP TypeScript monorepo work) —
each poller is an independently deployable service so one flaky feed (looking
at you, unofficial SMRT endpoint) can't take down the others, and each has
its own CI job so a broken AIS poller doesn't block a bus-layer deploy.

```
sg-transport-live/
├── apps/
│   ├── frontend-ts/          # MapLibre GL + TypeScript frontend
│   └── backend-ts/           # WS/SSE broadcaster (the "gateway") — the only thing the client talks to
├── services/
│   ├── bus-poller-ts/        # LTA DataMall bus arrival polling
│   ├── mrt-poller-ts/        # scheduled/simulated positions now, live inference later
│   ├── adsb-poller-py/       # Python: better ADS-B decoding library support
│   └── ais-poller-py/        # Python: better AIS decoding library support
├── packages/
│   ├── shared-types-ts/      # VehiclePosition and other cross-service contracts (TS only, see note below)
│   ├── geometry-ts/          # scripts to build + store static route/rail geometry (Turf.js)
│   └── mcp-server-py/        # optional: MCP query layer over the live state store (FastMCP)
├── infra/
│   └── docker/                # one Dockerfile per service
├── .github/
│   └── workflows/             # per-service CI: lint, typecheck, test, build, (deploy on tag)
├── turbo.json
├── package.json
├── DESIGN.md
└── TODO.md
```

Key structural decision: `shared-types-ts` is the contract every *TypeScript*
poller and `backend-ts` build against (the `VehiclePosition` interface from
§6 lives here). It's a TS package, so `adsb-poller-py` and `ais-poller-py`
can't import it directly — they need their own dataclass mirroring the same
JSON shape. That's a real seam, not just a naming detail: if the interface
in `shared-types-ts` changes, the Python-side mirror has to be updated by
hand and nothing will catch a drift at compile time. Worth adding a
contract test (e.g. a JSON Schema exported from `shared-types-ts` that both
sides validate against in CI) once more than one Python service exists —
noted as a TODO item rather than solved now, since it's only a problem once
Phase 5/6 (the Python pollers) actually land.
