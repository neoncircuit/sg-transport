# Credits

SG Live is inspired by two existing London transport maps:

- **[Zone One](https://london.jamespotter.dev/)** by James Potter — the original
  3D live map of London transport (Zone 1).
- **[London Live](https://london.pengrubin.com)** by Hongwei PENG
  ([pengrubin](https://github.com/pengrubin/london-live-2d)) — the 2D
  Greater-London adaptation this project’s approach is modeled on: MapLibre GL
  + TypeScript, GPS snapping for buses, and countdown-inferred train positions
  animated along real track geometry.

Basemap tiles via [OpenFreeMap](https://openfreemap.org) / Protomaps, built
from [OpenStreetMap](https://www.openstreetmap.org/copyright) data (ODbL).

Aircraft positions via [adsb.lol](https://adsb.lol) (community ADS-B aggregate;
local map use). Ship positions via [aisstream.io](https://aisstream.io)
(free API key; confirm redistribution terms before public deploy).

Live transport data (from Phase 2 onward) will come from
[LTA DataMall](https://datamall.lta.gov.sg/content/datamall/en.html) and
other sources; each will be attributed in the site footer and here when wired
up. Follow [`docs/datamall.md`](./docs/datamall.md) for official guides,
licence, and API terms.

Community GTFS used as an **MRT schedule fallback** for the simulator
(synthetic frequencies / first–last — not an official live feed):

- [Vorld/singapore-gtfs](https://github.com/Vorld/singapore-gtfs) (default zip)
- [thecrapone/singapore-gtfs-2026](https://github.com/thecrapone/singapore-gtfs-2026)
  (optional via `MRT_GTFS_URL`; large Git LFS zip)
