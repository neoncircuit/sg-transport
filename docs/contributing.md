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
pnpm lint
pnpm test
pnpm build
```

CI (`.github/workflows/ci.yml`) runs the same monorepo checks and builds
Docker images for the gateway / bus-poller on push to `main`.

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
