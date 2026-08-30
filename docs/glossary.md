# Glossary

| Term | Meaning |
|---|---|
| **SG Live** | This project — live 2D Singapore transport map |
| **Gateway** | `apps/backend-ts` — ingest + WebSocket fan-out to browsers |
| **Poller** | Service that produces `VehiclePosition[]` and `POST`s to `/ingest` |
| **Ingest** | `POST /ingest` body `{ source, vehicles }` into the gateway store |
| **VehicleStore** | In-memory merge of fake fleet + fresh poller overlays |
| **VehiclePosition** | Shared vehicle snapshot: `id`, `mode`, `lat`, `lon`, `bearing?`, `observedAt`, `isInferred` |
| **isInferred** | Position is simulated or schedule-based, not a live GPS fix |
| **Fixture** | On-disk JSON shaped like a DataMall response (offline / fallback) |
| **Skeleton** | Synthetic drifting fleet when no live or fixture data exists |
| **Cascade** | bus-poller order: live LTA → fixtures → skeleton |
| **Snap** | Project bus GPS onto nearest route polyline (`nearestPointOnLine`) |
| **AccountKey** | LTA DataMall API key (header only; never in the frontend) |
| **Dynamic dataset** | DataMall API feed (Arrival, Routes, Services, Stops, …) |
| **Ad-hoc** | Rarely changing DataMall list feed (Stops / Routes / Services) |

See `@sg-transport/shared-types` for the TypeScript contract, and
[Architecture](./architecture.md) for how these pieces connect.
