# Geometry spot-checks (Phase 1)

Manual notes against real Singapore MRT alignment. Revisit after each
`pnpm --filter @sg-transport/geometry extract:rail` refresh.

| Line | What to check | Status |
|---|---|---|
| **CCL** (Circle) | Closed loop; no obvious chord cuts across the island | Pending — inspect after first extract |
| **DTL** (Downtown) | Curves through downtown / Chinatown look smooth, not zig-zag stop-to-stop | Pending |
| **NSL** (North–South) | Straight-ish spine; Woodlands ↔ Marina Bay corridor | Pending |
| **BPLRT** | Choa Chu Kang loop present (`route=monorail` on OSM) | Present after monorail extract |
| **SKLRT** | East + West loops (not merged with Punggol) | Present |
| **PGLRT** | East + West loops as `PGLRT` (separate from SK) | Present after monorail extract |
| **CRL** / **CPE** | Dashed U/C geometry (`route=construction`) | Present |
| **JRL** | Dashed U/C geometry | Present |

How to spot-check: open `packages/geometry-ts/data/rail.geojson` on the local
map (rail layer) or in geojson.io, compare to Google/OneMap satellite for those
corridors. Note any `ref` that needs a hand-edited override file later.

Bus geometry (LTA stop-to-stop chords) will look angular until OSM way snapping
lands — that is expected for the first bus extract.
