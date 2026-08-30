# Documentation

Start here for how SG Live is built and how to work on it.

| Doc | Audience | What it covers |
|---|---|---|
| [Architecture](./architecture.md) | Engineers | Runtime topology, contracts, data flow |
| [Development](./development.md) | Contributors | Setup, scripts, env, verification |
| [Data & geometry](./data-and-geometry.md) | Engineers | Rail/bus extracts, fixtures, `data/lta/` |
| [LTA DataMall](./datamall.md) | Engineers | Official APIs, licence, dump layout |
| [Contributing](./contributing.md) | Contributors | Branches, commits, PR checklist |
| [Glossary](./glossary.md) | Everyone | Shared terms (`VehiclePosition`, ingest, …) |

## Product & planning (repo root / tasks)

These stay outside `docs/` on purpose — product vision vs engineering how-to:

| Doc | Purpose |
|---|---|
| [`DESIGN.md`](../DESIGN.md) | Product design, data-source strategy, UX, risks |
| [`tasks/TODO.md`](../tasks/TODO.md) | Phased build plan and ship tags |
| [`tasks/lessons.md`](../tasks/lessons.md) | Decisions and mistakes to remember |
| [`CREDITS.md`](../CREDITS.md) | Attribution |
| [`CLAUDE.md`](../CLAUDE.md) | Agent / contributor process overrides |

## External references

| File | Purpose |
|---|---|
| [`LTA_DataMall_API_User_Guide.pdf`](./LTA_DataMall_API_User_Guide.pdf) | Official API User Guide v6.9 (3 Aug 2026) |

Keep package-local READMEs (`packages/*/README.md`, `data/lta/README.md`) for
narrow how-tos; link up to this hub instead of duplicating architecture.
