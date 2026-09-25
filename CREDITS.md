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

Aircraft positions © [adsb.lol](https://adsb.lol), available under the
[Open Data Commons Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
SG Live normalizes and filters the source records for display.

Ship positions can be sourced from [aisstream.io](https://aisstream.io) for
local development. They are disabled in the public deployment until written
redistribution permission is obtained.

Bus arrival data is provided by
[LTA DataMall](https://datamall.lta.gov.sg/content/datamall/en.html) under the
[Singapore Open Data Licence](https://datamall.lta.gov.sg/content/datamall/en/SingaporeOpenDataLicence.html).
SG Live derives approximate display positions from arrival records and is not
endorsed by the Singapore Government. Follow
[`docs/datamall.md`](./docs/datamall.md) for official guides and API terms.

Community GTFS used as an **MRT schedule fallback** for the simulator
(synthetic frequencies / first–last — not an official live feed):

- [Vorld/singapore-gtfs](https://github.com/Vorld/singapore-gtfs) (default zip)
- [thecrapone/singapore-gtfs-2026](https://github.com/thecrapone/singapore-gtfs-2026)
  (optional via `MRT_GTFS_URL`; large Git LFS zip)
