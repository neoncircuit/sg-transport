# Lessons Learned

Living notes from building SG Live. Add a dated entry when something bites
us, surprises us, or should change how we work next phase. Keep entries
short and actionable.

---

## 2026-08-29 — Phase 0 scaffold

### Process

- **Design-first paid off.** `DESIGN.md` + `tasks/TODO.md` let us scaffold
  without inventing architecture mid-flight. Split Phase 0 into **0a (local
  demo)** and **0b (CI/Docker)** so we could ship a visible map before
  wrestling GHCR and deploy hosts.
- **Plan before code when the repo is empty.** Jumping straight into a
  monorepo scaffold without locking basemap / scope / branch name wasted a
  turn; three decisions (OpenFreeMap, local-first, `main`) unblocked the rest.
- **Commit only after checks are green.** Typecheck → lint → test → build,
  then commit. Interleaved “almost done” commits would have frozen broken
  `shared-types` exports into history.

### Technical

- **`VehiclePosition` is the real product boundary.** Fake Phase 0 vehicles,
  the bus-poller stub, and the MapLibre layer all speak the same shape. Keep
  pollers converging on that contract; don’t let source-specific fields leak
  into the client.
- **Package `exports` must work for Node, not just Vite/tsx.** Pointing
  `"import"` at `.ts` source broke `node dist/index.js` and Docker. Publish
  `dist/*.js` + `.d.ts`; let Turbo `^build` keep consumers honest.
- **pnpm + Docker:** `pnpm deploy --prod --legacy` produces a runnable image
  slice from a monorepo. Prefer that over copying the whole workspace into
  the runtime stage.
- **Windows + corporate TLS:** `UNABLE_TO_VERIFY_LEAF_SIGNATURE` against
  registry.npmjs.org blocked installs. Prefer fixing the trust store /
  `NODE_EXTRA_CA_CERTS` over leaving `strict-ssl false` permanently. Git
  also intermittently failed writing `.git/objects` (permission denied) —
  retry after a short pause; likely AV/indexer locking.

### Product / data (carry forward)

- **MRT has no official live position feed.** Ship scheduled/simulated
  trains (Phase 3) before betting the map on the unofficial SMRT countdown
  endpoint. Mark inferred/simulated clearly in the UI.
- **Buses are the fastest path to “real.”** LTA DataMall already returns
  lat/lon; don’t block the first impressive demo on rail geometry or AIS.
- **Attribution is part of the product.** Credits for Zone One (James
  Potter) and London Live (Hongwei PENG) belong in the footer and
  `CREDITS.md`, not only in the design doc.

### UI / UX direction (Phase 0 → polish)

- **Mobile-first** (DESIGN §11): primary user is on a phone in transit.
  Default chrome is a **bottom sheet** (peek + expand), not a desktop
  sidebar. Desktop gets a docked panel at `min-width: 720px`.
- Brand **SG Live** must still read clearly in the peek state.
- Default visual language: **harbour night** + alternate themes via
  `data-theme` + localStorage.
- Touch: ≥44px targets; invisible vehicle hit layer (~18px radius) for taps.
- **Locate me** is core chrome, not a nice-to-have.
- Battery: pause applying WS snapshots while `document.hidden`.
- Network: faster WS reconnect backoff for cellular flaps.
- Simulated data stays honest in the chrome (“simulated” / Phase badge).
- Public deploy remains last (Phase 8).

### Open follow-ups

- **Public deploy is last** (Phase 8) — do not rush a public URL while the
  map is still simulated / incomplete.
- Confirm LTA DataMall rate limits and licence before Phase 2 polling;
  obtain `LTA_ACCOUNT_KEY` to run `pnpm extract:bus`.
- Spot-check OSM MRT geometry (CCL / DTL / NSL) — `SPOT_CHECKS.md`.
- Overpass can 504 when busy; extractor retries kumi → overpass-api.de →
  private.coffee. Local TLS interception may need a fixed trust store.
