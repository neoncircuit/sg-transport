# Contributing

## Workflow

1. Branch from `main`: `feature/…`, `fix/…`, or `chore/…`
2. Keep changes focused; prefer small local commits
3. Run verification (below) before you consider the work done
4. Open a PR when ready — **batch pushes** when possible so CI minutes
   aren’t burned on every tiny commit

Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.

## Verification

```bash
pnpm typecheck
pnpm lint          # Biome (lint + format check)
pnpm lint:fix     # apply Biome autofixes locally
pnpm test
pnpm build
```

Python pollers (`adsb-poller-py`, `ais-poller-py`) and optional MCP package:

```bash
python3 -m pip install -e "services/adsb-poller-py[dev]"
python3 -m ruff check services/adsb-poller-py
python3 -m ruff format --check services/adsb-poller-py
python3 -m pytest services/adsb-poller-py/tests -q
# same for services/ais-poller-py and packages/mcp-server-py
```

Optional MCP (gateway must be running):

```bash
python3 -m pip install -e "packages/mcp-server-py[dev]"
GATEWAY_URL=http://127.0.0.1:8787 python3 -m sg_transport_mcp
```

CI (`.github/workflows/ci.yml`) runs Biome → typecheck → test → Ruff →
pytest → build, then Docker image builds (GHCR push on `main`).

To require these checks before merge, enable GitHub branch protection on
`main` and require the **Lint · typecheck · test · build** status check
(repo Settings → Branches — a one-time manual step).

## Boundaries

- Do not put AccountKeys or `.env` in git
- Do not call DataMall (or other live feeds) from the frontend
- Prefer fixing architecture smells over one-off hacks — see
  [`CLAUDE.md`](../CLAUDE.md) process overrides
- Product phases and “done when” criteria:
  [`tasks/TODO.md`](../tasks/TODO.md)

## Docs PRs

- Engineering how-to → `docs/`
- Product vision / trade-offs → `DESIGN.md`
- Capture lasting lessons in `tasks/lessons.md`

## Credits

Attribute inspiration and data sources — [`CREDITS.md`](../CREDITS.md),
[`docs/datamall.md`](./datamall.md).
