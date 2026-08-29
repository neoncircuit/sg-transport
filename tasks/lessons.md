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

- The map **is** the hero — full-bleed MapLibre, not a dashboard of cards.
- Brand **SG Live** must read as the primary signal in the first viewport;
  status text and legends are secondary.
- Default visual language: **harbour night** — deep ink basemap, warm amber,
  cool cyan, live pulse. Also ship alternate HUD themes (cyberpunk yellow,
  hacker neon, tron blue, gunmetal) via `data-theme` + localStorage; vehicle
  dots recolour with the active theme. Avoid cream+terracotta poster looks
  and broadsheet chrome as defaults.
- HUD should feel like glass over the city (blur, thin rules), not floating
  material cards. Mode legend + live counts earn their space; stats strips
  and promo chips do not.
- Motion: intentional only — HUD entrance, live pulse, vehicle glow. No
  decorative particle noise.
- Simulated data must stay honest in the chrome (“simulated” / Phase badge)
  so we never train users to trust fake positions as live LTA.

### Open follow-ups

- Choose a public host (Cloudflare / Fly / etc.) for Phase 0b deploy.
- Confirm LTA DataMall rate limits and licence before Phase 2 polling.
- Spot-check OSM MRT geometry before locking animation paths (Phase 1).
