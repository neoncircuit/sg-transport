# LTA DataMall — official references

Primary offline copy in this repo (keep in sync when LTA publishes a new
version):

- **[`LTA_DataMall_API_User_Guide.pdf`](./LTA_DataMall_API_User_Guide.pdf)** —
  *API User Guide & Documentation*, **Version 6.9 (3 Aug 2026)**

Portal links (for fresh downloads / licence pages):

| Resource | Where |
|---|---|
| DataMall home | https://datamall.lta.gov.sg/content/datamall/en.html |
| Dynamic Datasets | https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html |
| Contact Us (User Guide PDF link) | https://datamall.lta.gov.sg/content/datamall/en/contact-us.html |
| Request AccountKey | “Request for API Access” on the DataMall / Dynamic Datasets pages |

## Licence & terms (read before public redistribute)

| Resource | Where |
|---|---|
| Singapore Open Data Licence | https://datamall.lta.gov.sg/content/datamall/en/SingaporeOpenDataLicence.html |
| Terms of Service for API and SDK | https://datamall.lta.gov.sg/content/datamall/en/api-terms-of-service.html |

Notable ToS point for polling: daily API call threshold (currently
**10 million**/day on the published Terms — confirm on the live page).

## Calling conventions (from the User Guide §1–2)

- Auth: HTTP header `AccountKey` (only).
- Default response: JSON (`Accept: application/json`).
- List APIs return **max 500 rows** per call; page with `$skip=500`,
  `$skip=1000`, … (e.g. `BusRoutes?$skip=500`).
- Bus Arrival is **not** paginated that way — size depends on the stop
  (and optional `ServiceNo`).

## Four bus Dynamic Datasets (our Phase 2 focus)

| Dataset | Guide § | URL path | Cadence | Local dump |
|---|---|---|---|---|
| Bus Arrival | 2.1 | `/ltaodataservice/v3/BusArrival` | **20 seconds** | `data/lta/BusArrival/BusArrival.json` (or `<code>.json`) |
| Bus Services | 2.2 | `/ltaodataservice/BusServices` | Ad hoc | `data/lta/BusServices/BusServices.json` |
| Bus Routes | 2.3 | `/ltaodataservice/BusRoutes` | Ad hoc | `data/lta/BusRoutes/BusRoutes.json` |
| Bus Stops | 2.4 | `/ltaodataservice/BusStops` | Ad hoc | `data/lta/BusStops/BusStops.json` |

Base host: `https://datamall2.mytransport.sg`

**Arrival notes (v3):** required `BusStopCode`; optional `ServiceNo`. Each
service exposes `NextBus` / `NextBus2` / `NextBus3` with `Latitude`,
`Longitude`, `EstimatedArrival`, `Load`, `VisitNumber`, and `Monitored`
(`1` = ETA from bus location, `0` = schedule — treat schedule-only as
inferred when normalizing).

**Ad-hoc trio:** use for geometry (Stops + Routes) and metadata (Services).
Optional filters: `ServiceNo` on Bus Services, `BusStopCode` on Bus Stops
(v6.8+).

See [`data/lta/README.md`](../data/lta/README.md) for dump naming.
AccountKey stays in `.env` only — never commit it.

## Fallback role of local dumps

`data/lta/` is not only a pre-key development aid — it is the **offline /
API-failure fallback** for the bus poller:

1. **Live** DataMall Arrival (when `LTA_ACCOUNT_KEY` works)
2. **Fixture** — local Arrival JSON under `data/lta/BusArrival/`
3. **Skeleton** — synthetic fleet so the map never goes empty

`BUS_SOURCE=auto` (default) walks that cascade every tick. Geometry extract
likewise prefers local Stops/Routes before hitting the network.
